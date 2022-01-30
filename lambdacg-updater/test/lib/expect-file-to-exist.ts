import { expect } from "chai";
import fsu from "lambdacg-updater/fs-utils";
import path from "path";

const expectDirectoryToExistAsync = async (
    filePath: string,
    basePath?: string
) => {
    const fullPath = basePath ? path.join(basePath, filePath) : filePath;
    expect(
        await fsu.directoryExistsAsync(fullPath),
        `'${filePath}' should be an existing directory`
    ).to.be.true;
};

const expectFileToExistAsync = async (dirPath: string, basePath?: string) => {
    const fullPath = basePath ? path.join(basePath, dirPath) : dirPath;
    expect(
        await fsu.fileExistsAsync(fullPath),
        `'${dirPath}' should be an existing file`
    ).to.be.true;
};

export { expectDirectoryToExistAsync, expectFileToExistAsync };
