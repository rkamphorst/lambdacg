import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import path from "node:path";
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

const getAssetStreamAsync = async (assetName: string): Promise<Readable> => {
    const packageRoot = await findPackageRootAsync(__dirname);
    const assetPath = path.join(packageRoot, "assets", assetName);

    if (!(await fsu.fileExistsAsync(assetPath))) {
        throw new Error(`Asset not found: ${assetName}`);
    }

    return createReadStream(assetPath);
};

export { getAssetStreamAsync };
