import { exec } from "child_process";
import { createWriteStream } from "fs";
import gunzip from "gunzip-maybe";
import { PassThrough, Readable } from "node:stream";
import tarStream from "tar-stream";
import { tmpName } from "tmp";

import { streamFinishedAsync } from "../src/stream-utils";
import fsu from "./fs-utils";

type NpmPackageInfo = {
    [key: string]: unknown;
};

type TemporaryNpmTarball = {
    location: string;
    info: NpmPackageInfo;
};

function npmInstallAsync(targetDir: string, packages: string[]): Promise<void> {
    if (packages.length == 0) {
        return Promise.resolve();
    }
    const cmdString = `npm install --save --ignore-scripts --production --prefix "${targetDir}" "${packages.join(
        '" "'
    )}"`;

    return new Promise(function (resolve, reject) {
        exec(cmdString, { maxBuffer: 200 * 1024 }, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function readNpmPackageInfoAsync(stream: Readable): Promise<NpmPackageInfo> {
    return new Promise((resolve, reject) => {
        const gunzipTransform = gunzip();
        const extractTransform = tarStream.extract();

        let isResolvedOrRejected = false;

        const resolveOrRejectOnce = (
            error: unknown,
            resolveValue: NpmPackageInfo | undefined
        ) => {
            if (!isResolvedOrRejected) {
                if (error) {
                    reject(error);
                } else {
                    resolve(resolveValue as NpmPackageInfo);
                }
            }
        };

        const resolveOnce = (resolveValue: NpmPackageInfo) =>
            resolveOrRejectOnce(undefined, resolveValue);
        const rejectOnce = (error: unknown) =>
            resolveOrRejectOnce(error, undefined);

        extractTransform.on("entry", function (header, fileStream, next) {
            // header is the tar header
            // fileStream is the content body (might be an empty stream)

            if (
                header.type === "file" &&
                /^(\.\/)?package\/package.json$/.test(header.name)
            ) {
                // read the file and try to parse it as JSON
                const chunks: Buffer[] = [];

                fileStream.on("data", (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                fileStream.on("end", () => {
                    try {
                        const pkgSpec = JSON.parse(
                            Buffer.concat(chunks).toString("utf-8")
                        );
                        resolveOnce(pkgSpec);
                    } catch (error) {
                        rejectOnce(error);
                    } finally {
                        isResolvedOrRejected = true;
                        destroyStreams();
                    }
                });

                fileStream.on("error", rejectOnce);
            } else {
                // skkip this file, auto drain the fileStream
                fileStream.on("end", () => next());
                fileStream.resume();
            }
        });

        extractTransform.on("finish", () =>
            rejectOnce(
                Error("Not a valid NPM tarball, no package/package.json found")
            )
        );

        extractTransform.on("close", () =>
            rejectOnce(
                Error("Not a valid NPM tarball, no package/package.json found")
            )
        );

        extractTransform.on("error", rejectOnce);

        stream.pipe(gunzipTransform).pipe(extractTransform);

        function destroyStreams() {
            gunzipTransform.unpipe(extractTransform);
            stream.unpipe(gunzipTransform);

            extractTransform.destroy();
            gunzipTransform.destroy();
        }
    });
}

const tmpTgzNameAsync = (dirname?: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        tmpName(
            {
                postfix: "npmpkg.tgz",
                dir: dirname,
            },
            (error, name) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(name);
                }
            }
        );
    });
};

async function storeTemporaryNpmTarballAsync(
    fromStream: Readable,
    dirname?: string
): Promise<TemporaryNpmTarball> {
    const destTgz = await tmpTgzNameAsync(dirname);
    const destStream = createWriteStream(destTgz);
    const readStream = new PassThrough();

    fromStream.pipe(destStream);
    fromStream.pipe(readStream);

    try {
        const info = await readNpmPackageInfoAsync(readStream);

        await streamFinishedAsync(destStream);

        return {
            location: destTgz,
            info: info,
        };
    } catch (e) {
        destStream.destroy();
        await fsu.tryRemoveFileAsync(destTgz);
        throw e;
    }
}

export {
    npmInstallAsync,
    NpmPackageInfo,
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync,
    TemporaryNpmTarball,
};
