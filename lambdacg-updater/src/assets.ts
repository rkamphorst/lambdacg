import { createReadStream } from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import fsu from "./fs-utils";

const findPackageRootAsync = async (startPath: string): Promise<string> => {
    let curPath = path.resolve(startPath);

    if (!(await fsu.directoryExistsAsync(startPath))) {
        throw new Error(`Path is not a directory: ${startPath}`);
    }

    while (true) {
        if (await fsu.fileExistsAsync(path.join(curPath, "package.json"))) {
            return curPath;
        }

        const parentPath = path.dirname(curPath);
        if (!(parentPath.length < curPath.length)) {
            throw new Error(`Path is not in a package: ${startPath}`);
        }
        curPath = parentPath;
    }
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
