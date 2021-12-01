import fs from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import tar from "tar-stream";
import gunzip from "gunzip-maybe";

const unpackNpmPackageContentsInTarball = async (
    inputStream: Readable
): Promise<string> => {
    const tmpdir: string = await mkdtemp(
        path.join(os.tmpdir(), "lambdacg-resolver-unpack-")
    );

    try {
        return await new Promise((resolve, reject) => {
            const gunzipTransform = gunzip();
            const extractTransform = tar.extract();

            inputStream.pipe(gunzipTransform).pipe(extractTransform);

            extractTransform.on("entry", function (header, stream, next) {
                const pkgDirMatch = /^(\.\/)?package\/(.+)$/.exec(header.name);

                if (header.type == "file" && pkgDirMatch) {
                    const relativePath = pkgDirMatch[2];
                    const absPath = path.join(tmpdir, relativePath);
                    const absDirPath = path.dirname(absPath);
                    fs.mkdir(absDirPath, { recursive: true });
                    const writeStream = createWriteStream(absPath);
                    stream.pipe(writeStream);
                } else {
                    stream.resume(); // just auto drain the stream
                }
                stream.on("end", next);
            });

            extractTransform.on("finish", () => resolve(tmpdir));
            extractTransform.on("error", (err) => reject(err));
        });
    } catch (error) {
        await fs.rm(tmpdir, { recursive: true, force: true });
        throw error;
    }
};

export { unpackNpmPackageContentsInTarball };
