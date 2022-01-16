import archiver from "archiver";
import { rmSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import { Readable } from "stream";

import {
    storeTemporaryNpmTarballAsync,
    TemporaryNpmTarball,
} from "./npm-utils";
import { unpackNpmPackageContentsInTarball } from "./unpack";
import {
    RepositoryTarballInterface,
    ResolverPackageInterface,
} from "./updater-contract";

class ResolverPackage implements ResolverPackageInterface {
    #directoryPromise: Promise<string> | undefined;
    #addModulePromises: {
        tarballName: string;
        promise: Promise<TemporaryNpmTarball>;
    }[];

    #getPackageAssetStream: () => Readable;
    #npmInstallAsync: (targetDir: string, packages: string[]) => Promise<void>;

    constructor(
        getPackageAssetStream: () => Readable,
        npmInstallAsync: (
            targetDir: string,
            packages: string[]
        ) => Promise<void>
    ) {
        this.#addModulePromises = [];
        this.#getPackageAssetStream = getPackageAssetStream;
        this.#npmInstallAsync = npmInstallAsync;
    }

    addHandlerTarball(tarball: RepositoryTarballInterface): void {
        if (
            this.#addModulePromises.findIndex(
                (x) => x.tarballName === tarball.name
            ) >= 0
        ) {
            throw new Error(
                `A tarball with name ${tarball.name} was already added`
            );
        }
        this.#addModulePromises.push({
            tarballName: tarball.name,
            promise: this.#saveTarballToTemporaryDirectoryAsync(
                tarball.getDownloadStream()
            ),
        });
    }

    async #saveTarballToTemporaryDirectoryAsync(
        tarballStream: Readable
    ): Promise<TemporaryNpmTarball> {
        if (!this.#directoryPromise) {
            this.#directoryPromise = fs.mkdtemp(
                path.join(os.tmpdir(), "lambdacg-updater-tmp-")
            );
        }
        const tmpdir = await this.#directoryPromise;

        return await storeTemporaryNpmTarballAsync(tarballStream, tmpdir);
    }

    async createCodeZipStreamAsync(): Promise<Readable> {
        const result = new PassThrough();

        // we could have just kicked this off and returned
        // the stream without awaiting.
        // however, that could cause a timeout on any writable
        // on the other end; therefore, we first await the
        // packaging and then return the stream.
        await this.#packageAndZipToStreamAsync(result);

        return result;
    }

    async #packageAndZipToStreamAsync(writeStream: Writable) {
        try {
            // create a package directory and await the "add module" promises;
            // we can do this in parallel
            const [packageDirectory, tarballNamesAndFiles] = await Promise.all([
                unpackNpmPackageContentsInTarball(
                    this.#getPackageAssetStream()
                ),
                Promise.all(
                    this.#addModulePromises.map(async (p) => ({
                        tarballName: p.tarballName,
                        tarballInfo: await p.promise,
                    }))
                ),
            ]);

            // install the fetched modules, and write the handlerFactories.json file.
            // again, this can be done in parallel
            await Promise.all([
                this.#npmInstallAsync(
                    packageDirectory,
                    tarballNamesAndFiles.map(
                        ({ tarballInfo }) => tarballInfo.location
                    )
                ),
                fs.writeFile(
                    path.join(packageDirectory, "handlerFactories.json"),
                    JSON.stringify(
                        tarballNamesAndFiles.map(
                            (i) => i.tarballInfo.info["name"]
                        )
                    )
                ),
            ]);

            // archive and pipe to the write stream
            const archive = archiver("zip");
            archive.pipe(writeStream);

            // when zip is completed, remove package dir.
            // do this synchronously for now because nobody is waiting anyway.
            // don't know what happens if we do it async and don't await it...
            archive.on("finish", () => {
                rmSync(packageDirectory, { force: true, recursive: true });
            });

            // add package directory
            archive.directory(packageDirectory, false);

            await archive.finalize();
        } catch (err) {
            writeStream.destroy(
                err instanceof Error ? err : new Error(`${err}`)
            );
        }
    }

    async cleanupAsync(): Promise<void> {
        let directory: string | undefined = undefined;
        const directoryPromise = this.#directoryPromise;
        this.#directoryPromise = undefined;

        const addModulePromises = [...this.#addModulePromises];
        this.#addModulePromises.length = 0;

        await Promise.all([
            (async () => {
                if (directoryPromise) {
                    try {
                        directory = await directoryPromise;
                    } catch {
                        /* skip */
                    }
                }
            })(),
            ...addModulePromises.map(async ({ promise }) => {
                try {
                    await promise;
                } catch {
                    /* skip */
                }
            }),
        ]);

        if (directory) {
            await fs.rm(directory, { force: true, recursive: true });
        }
    }
}

export { ResolverPackage };
