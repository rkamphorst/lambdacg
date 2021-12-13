import fs from "node:fs/promises";
import { Stats } from "node:fs";

const tryFstatAsync = async (filePath: string): Promise<Stats | null> => {
    try {
        return await fs.stat(filePath);
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
        }
        throw e;
    }
};

const fileExistsAsync = async (filePath: string): Promise<boolean> => {
    return !!(await tryFstatAsync(filePath))?.isFile();
};

const directoryExistsAsync = async (dirPath: string): Promise<boolean> => {
    return !!(await tryFstatAsync(dirPath))?.isDirectory();
};

const tryRemoveFileAsync = (filename: string): Promise<boolean> => {
    return fs
        .unlink(filename)
        .then(() => true)
        .catch(() => false);
};

export default { fileExistsAsync, directoryExistsAsync, tryRemoveFileAsync };
