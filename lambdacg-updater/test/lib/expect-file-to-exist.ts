import { expect } from "chai";
import path from "path";
import fsu from "lambdacg-updater/fs-utils";

const expectDirectoryToExistAsync = async (
    filePath: string,
    basePath?: string
) => {
    const fullPath = basePath ? path.join(basePath, filePath) : filePath;
    expect(
        await fsu.directoryExistsAsync(fullPath),
        `'${filePath}' is an existing file`
    ).to.be.true;
};

const expectFileToExistAsync = async (dirPath: string, basePath?: string) => {
    const fullPath = basePath ? path.join(basePath, dirPath) : dirPath;
    expect(
        await fsu.fileExistsAsync(fullPath),
        `'${dirPath}'' is an existing directory`
    ).to.be.true;
};

export { expectDirectoryToExistAsync, expectFileToExistAsync };
