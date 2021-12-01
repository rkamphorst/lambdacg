import fs from "node:fs/promises";
import fse from "lambdacg-updater/fs-exists";
import { tmpName } from "tmp";
import { expect } from "chai";
import { promisify } from "node:util";

const tmpNameAsync = promisify(tmpName);

describe("FsExists", () => {
    describe("fileExistsAsync", () => {
        it("Should return true if it exists and is a file", async () => {
            const filename = await tmpNameAsync();
            try {
                await fs.writeFile(filename, "data", "utf-8");

                const result = await fse.fileExistsAsync(filename);

                expect(result).to.be.true;
            } finally {
                await fs.rm(filename, { force: true });
            }
        });
        it("Should return false if it exists but is not a file", async () => {
            const dirname = await fs.mkdtemp("lambdacg-updater-test-");

            try {
                const result = await fse.fileExistsAsync(dirname);

                expect(result).to.be.false;
            } finally {
                await fs.rm(dirname, { recursive: true, force: true });
            }
        });

        it("Should return false if it does not exist", async () => {
            const filename = await tmpNameAsync();
            const result = await fse.fileExistsAsync(filename);
            expect(result).to.be.false;
        });
    });
});
