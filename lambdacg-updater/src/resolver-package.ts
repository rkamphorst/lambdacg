import { Readable } from "stream";
import { ResolverPackageInterface } from "./updater-contract";
import fs from "node:fs/promises";
import { rmSync } from "node:fs";
import path from "node:path";
import { Writable, PassThrough } from "node:stream";
import { unpackNpmPackageContentsInTarball } from "./unpack";
import {
    npmInstallAsync,
    storeTemporaryNpmTarballAsync,
    TemporaryNpmTarball,
} from "./npm-utils";
import archiver from "archiver";

class ResolverPackage implements ResolverPackageInterface {
    #directoryPromise: Promise<string> | undefined;
    #addModulePromises: {
        tarballName: string;
        promise: Promise<TemporaryNpmTarball>;
    }[];
    #getPackageAssetStream: () => Readable;

    constructor(getPackageAssetStream: () => Readable) {
        this.#addModulePromises = [];
        this.#getPackageAssetStream = getPackageAssetStream;
    }

    addHandlerFromTarballStream(
        tarballName: string,
        tarballStream: Readable
    ): void {
        if (
            this.#addModulePromises.findIndex(
                (x) => x.tarballName.toUpperCase() == tarballName.toUpperCase()
            ) >= 0
        ) {
            throw new Error(
                `A tarball with name ${tarballName} was already added`
            );
        }
        this.#addModulePromises.push({
            tarballName,
            promise: this.#saveTarballToTemporaryDirectoryAsync(
                tarballName,
                tarballStream
            ),
        });
    }

    async #saveTarballToTemporaryDirectoryAsync(
        tarballName: string,
        tarballStream: Readable
    ): Promise<TemporaryNpmTarball> {
        if (!this.#directoryPromise) {
            this.#directoryPromise = fs.mkdtemp("lambdacg-updater-tmp-");
        }
        const tmpdir = await this.#directoryPromise;

        return await storeTemporaryNpmTarballAsync(tarballStream, tmpdir);
    }

    createLambdaCodeZipStream(): Readable {
        const result = new PassThrough();

        // we don't have to await the following  async call,
        // as it will be "awaited" by the stream reader
        this.#packageAndZipToStreamAsync(result);

        return result;
    }

    async #packageAndZipToStreamAsync(writeStream: Writable) {
        // create a package directory and await the "add module" promises;
        // we can do this in parallel
        const [packageDirectory, tarballNamesAndFiles] = await Promise.all([
            unpackNpmPackageContentsInTarball(this.#getPackageAssetStream()),
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
            npmInstallAsync(
                packageDirectory,
                tarballNamesAndFiles.map(
                    ({ tarballInfo }) => tarballInfo.location
                )
            ),
            fs.writeFile(
                path.join(packageDirectory, "handlerFactories.json"),
                JSON.stringify(
                    tarballNamesAndFiles.map((i) => i.tarballInfo.info["name"])
                )
            ),
        ]);

        // archive and pipe to the write stream
        const archive = archiver("zip");
        archive.pipe(writeStream);

        // add package directory
        archive.directory(packageDirectory, false);

        // when zip is completed, remove package dir.
        // do this synchronously for now because nobody is waiting anyway.
        // don't know what happens if we do it async and don't await it...
        archive.on("close", () => {
            rmSync(packageDirectory, { force: true, recursive: true });
        });
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
