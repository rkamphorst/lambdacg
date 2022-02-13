import archiver from "archiver";
import { rmSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { finished, PassThrough } from "node:stream";
import { Readable } from "stream";

import {
    NpmPackageInfo,
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync,
    TemporaryNpmTarball,
} from "./npm-utils";
import { unpackNpmPackageContentsInTarball } from "./unpack";
import {
    RepositoryTarballInterface,
    ResolverCodeZip,
    ResolverPackageInfo,
    ResolverPackageInterface,
} from "./updater-contract";

const toResolverPackageInfo = (npmPackageInfo: NpmPackageInfo) => {
    return {
        main: npmPackageInfo.main ?? "index",
        name: npmPackageInfo.name,
        version: npmPackageInfo.version,
    } as ResolverPackageInfo;
};

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

    async createCodeZipAsync(): Promise<ResolverCodeZip> {
        const writeStream = new PassThrough();

        // create a package directory and await the "add module" promises;
        // we can do this in parallel
        const assetStream = this.#getPackageAssetStream();

        const unpackStream = new PassThrough();
        const infoStream = new PassThrough();
        assetStream.pipe(unpackStream);
        assetStream.pipe(infoStream);

        const [packageDirectory, packageInfo, tarballNamesAndFiles] =
            await Promise.all([
                unpackNpmPackageContentsInTarball(unpackStream),
                readNpmPackageInfoAsync(infoStream),
                Promise.all(
                    this.#addModulePromises.map(async (p) => ({
                        tarballName: p.tarballName,
                        tarballInfo: await p.promise,
                    }))
                ),
            ]);

        // install the fetched modules

        await this.#npmInstallAsync(
            packageDirectory,
            tarballNamesAndFiles.map(({ tarballInfo }) => tarballInfo.location)
        );

        // archive and pipe to the write stream
        const archive = archiver("zip");
        archive.pipe(writeStream);

        // when zip is completed, remove package dir.
        // do this synchronously for now because nobody is waiting anyway.
        // don't know what happens if we do it async and don't await it...
        finished(archive, () => {
            rmSync(packageDirectory, { force: true, recursive: true });
        });

        // add package directory
        archive.directory(packageDirectory, false);

        archive.finalize();

        return {
            packageInfo: toResolverPackageInfo(packageInfo),
            stream: writeStream,
            handlerFactories: tarballNamesAndFiles.map(
                (i) => i.tarballInfo.info["name"]
            ),
        } as ResolverCodeZip;
    }

    async cleanupAsync(): Promise<void> {
        let directory: string | undefined = undefined;
        const directoryPromise = this.#directoryPromise;
        this.#directoryPromise = undefined;

        const addModulePromises = [...this.#addModulePromises];
        this.#addModulePromises.length = 0;

        // await creation of tmp directory
        try {
            directory = await directoryPromise;
        } catch {
            /* skip */
        }

        // await addition of all modules
        for (const mp of addModulePromises) {
            try {
                await mp;
            } catch {
                /* skip */
            }
        }

        if (directory) {
            await fs.rm(directory, { force: true, recursive: true });
        }
    }
}

export { ResolverPackage };
