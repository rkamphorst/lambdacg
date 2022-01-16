import { expect } from "chai";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import Sinon from "sinon";
import { tmpName } from "tmp";

import fsu from "../src/fs-utils";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

const tmpNameAsync = promisify(tmpName);

const { fileExistsAsync, directoryExistsAsync, tryRemoveFileAsync } = fsu;

describe("FsUtils", () => {
    describeObject({ fileExistsAsync }, function () {
        it("Should return true if it exists and is a file", async function () {
            const filename = await tmpNameAsync();
            try {
                await fs.writeFile(filename, "data", "utf-8");

                const result = await fsu.fileExistsAsync(filename);

                expect(result).to.be.true;
            } finally {
                await fs.rm(filename, { recursive: true, force: true });
            }
        });
        it("Should return false if it exists but is not a file", async function () {
            const dirname = await createTemporaryDirAsync();

            try {
                const result = await fsu.fileExistsAsync(dirname);

                expect(result).to.be.false;
            } finally {
                await fs.rm(dirname, { recursive: true, force: true });
            }
        });

        it("Should return false if it does not exist", async function () {
            const filename = await tmpNameAsync();
            const result = await fsu.fileExistsAsync(filename);
            expect(result).to.be.false;
        });
        it("Should throw if filesystem throws a weird error", async function () {
            const statStub = Sinon.stub(fs, "stat").throws(
                new Error("Weird error")
            );
            const filename = await tmpNameAsync();

            try {
                await expectToThrowAsync(() => fsu.fileExistsAsync(filename));
            } finally {
                statStub.restore();
            }
        });
    });

    describeObject({ directoryExistsAsync }, function () {
        it("Should return true if it exists and is a directory", async () => {
            const dirname = await createTemporaryDirAsync();
            try {
                const result = await fsu.directoryExistsAsync(dirname);

                expect(result).to.be.true;
            } finally {
                await fs.rm(dirname, { recursive: true, force: true });
            }
        });
        it("Should return false if it exists and is not a directory", async () => {
            const filename = await tmpNameAsync();
            try {
                await fs.writeFile(filename, "data", "utf-8");

                const result = await fsu.directoryExistsAsync(filename);

                expect(result).to.be.false;
            } finally {
                await fs.rm(filename, { recursive: true, force: true });
            }
        });
        it("Should return false if it does not exist", async () => {
            const dirname = await tmpNameAsync();
            const result = await fsu.fileExistsAsync(dirname);
            expect(result).to.be.false;
        });
    });

    describeObject({ tryRemoveFileAsync }, function () {
        it("Should remove the file and return true", async function () {
            const filename = await tmpNameAsync();
            try {
                await fs.writeFile(filename, "data", "utf-8");

                const result = await fsu.tryRemoveFileAsync(filename);

                expect(result).to.be.true;
            } finally {
                await fs.rm(filename, { recursive: true, force: true });
            }
        });

        it("Should return false if it fails", async function () {
            const dirname = await createTemporaryDirAsync();
            try {
                const result = await fsu.tryRemoveFileAsync(dirname);

                expect(result).to.be.false;
            } finally {
                await fs.rm(dirname, { recursive: true, force: true });
            }
        });
    });
});
