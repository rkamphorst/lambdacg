import { createReadStream } from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import fsu from "./fs-utils";

const findPackageRootAsync = async (startPath: string): Promise<string> => {
    if (!fsu.directoryExistsAsync(startPath)) {
        throw new Error(`Path is not a directory: ${startPath}`);
    }

    if (await fsu.fileExistsAsync(path.join(startPath, "package.json"))) {
        return startPath;
    }
    return await findPackageRootAsync(path.dirname(startPath));
};

const getAssetStream = (assetName: string): Readable => {
    const result = new PassThrough();

    const findFileAndPipeToResultAsync = async () => {
        try {
            const packageRoot = await findPackageRootAsync(__dirname);
            const assetPath = path.join(packageRoot, "assets", assetName);

            if (!(await fsu.fileExistsAsync(assetPath))) {
                throw new Error(`Asset not found: ${assetName}`);
            }

            createReadStream(assetPath).pipe(result);
        } catch (e) {
            result.destroy(e instanceof Error ? e : undefined);
        }
    };

    findFileAndPipeToResultAsync();
    return result;
};

export { getAssetStream };
