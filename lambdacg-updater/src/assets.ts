import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import path from "node:path";
import fse from "./fs-exists";

const findPackageRootAsync = async (startPath: string): Promise<string> => {
    if (!fse.directoryExistsAsync(startPath)) {
        throw new Error(`Path is not a directory: ${startPath}`);
    }

    if (await fse.fileExistsAsync(path.join(startPath, "package.json"))) {
        return startPath;
    }
    return await findPackageRootAsync(path.dirname(startPath));
};

const getAssetStreamAsync = async (assetName: string): Promise<Readable> => {
    const packageRoot = await findPackageRootAsync(__dirname);
    const assetPath = path.join(packageRoot, "assets", assetName);

    if (!(await fse.fileExistsAsync(assetPath))) {
        throw new Error(`Asset not found: ${assetName}`);
    }

    return createReadStream(assetPath);
};

export { getAssetStreamAsync };
