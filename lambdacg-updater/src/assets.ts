import { createReadStream } from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import fsu from "./fs-utils";

const findPackageRootAsync = async (startPath: string): Promise<string> => {
    if (!(await fsu.directoryExistsAsync(startPath))) {
        throw new Error(`Path is not a directory: ${startPath}`);
    }

    let parentPath = path.resolve(startPath);
    let curPath = parentPath;

    do {
        curPath = parentPath;
        if (await fsu.fileExistsAsync(path.join(curPath, "package.json"))) {
            return curPath;
        }

        parentPath = path.dirname(curPath);
    } while (parentPath.length < curPath.length);

    throw new Error(`Path is not in a package: ${startPath}`);
};

const getAssetStream = (
    assetName: string,
    relativeToPath?: string
): Readable => {
    const result = new PassThrough();

    const findFileAndPipeToResultAsync = async () => {
        try {
            const packageRoot = await findPackageRootAsync(
                relativeToPath ?? __dirname
            );
            const assetPath = path.join(packageRoot, "assets", assetName);

            if (!(await fsu.fileExistsAsync(assetPath))) {
                throw new Error(`Asset not found: ${assetName}`);
            }

            createReadStream(assetPath).pipe(result);
        } catch (e) {
            result.destroy(e as Error);
        }
    };

    findFileAndPipeToResultAsync();
    return result;
};

export { getAssetStream };
