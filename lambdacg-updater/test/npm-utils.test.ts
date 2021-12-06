import path from "path";
import fs from "fs";
import {
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync,
} from "lambdacg-updater/npm-utils";
import { expect, assert } from "chai";
import { PassThrough } from "stream";
import streamEqualAsync from "stream-equal";

const dataDir = path.join(__dirname, "data", "npm-utils.test");

describe("NpmUtils", () => {
    describe("readNpmPackageInfoAsync", () => {
        for (const validpackageTgz of [
            "validpackage1.tgz",
            "validpackage.tgz",
        ]) {
            const packagePath = path.join(dataDir, validpackageTgz);
            it(`Should read pakage.json from ${packagePath}`, async () => {
                const readStream = fs.createReadStream(packagePath);

                const packageInfo = await readNpmPackageInfoAsync(readStream);

                expect(packageInfo).to.be.deep.equal({
                    name: "valid-package-name",
                    version: "1.2.3",
                });
            });
        }

        for (const invalidPackageTgz of [
            "invalidpackage.tgz",
            "invalidpackage1.tgz",
        ]) {
            const packagePath = path.join(dataDir, invalidPackageTgz);

            it(`Should throw an exception when reading from ${packagePath}}`, async () => {
                const readStream = fs.createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    readNpmPackageInfoAsync(readStream)
                );
            });
        }

        it("Should be usable while parallel stream is completely read", async () => {
            const packagePath = path.join(dataDir, "biggerpackage.tgz");
            const readStream = fs.createReadStream(packagePath);
            const fileCopyStream = new PassThrough();
            const readInfoStream = new PassThrough();

            readStream.pipe(fileCopyStream);
            readStream.pipe(readInfoStream);

            try {
                const [packageInfo, streamsAreEqual] = await Promise.all([
                    readNpmPackageInfoAsync(readInfoStream),
                    streamEqualAsync(
                        fileCopyStream,
                        fs.createReadStream(packagePath)
                    ),
                ]);

                expect(packageInfo).to.be.deep.equal({
                    name: "biggerpackage",
                    property: "value",
                });
                expect(streamsAreEqual).to.be.true;
            } finally {
                fileCopyStream.destroy();
                readInfoStream.destroy();
            }
        });
    });

    describe("storeTemporaryNpmTarballAsync", () => {
        for (const validpackageTgz of [
            "validpackage1.tgz",
            "validpackage.tgz",
        ]) {
            const packagePath = path.join(dataDir, validpackageTgz);
            it(`Should store ${packagePath} and return package info`, async () => {
                const readStream = fs.createReadStream(packagePath);

                const result = await storeTemporaryNpmTarballAsync(readStream);

                expect(fs.existsSync(result.location)).to.be.true;

                const streamsAreEqual = await streamEqualAsync(
                    fs.createReadStream(packagePath),
                    fs.createReadStream(result.location)
                );

                expect(streamsAreEqual).to.be.true;
                expect(result.info).to.be.deep.equal({
                    name: "valid-package-name",
                    version: "1.2.3",
                });

                fs.unlinkSync(result.location);
            });
        }

        for (const invalidPackageTgz of [
            "invalidpackage.tgz",
            "invalidpackage1.tgz",
        ]) {
            const packagePath = path.join(dataDir, invalidPackageTgz);
            it(`Should not store package and throw an exception when reading from ${packagePath}`, async () => {
                const readStream = fs.createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    storeTemporaryNpmTarballAsync(readStream)
                );
            });
        }
    });
});

async function expectToThrowAsync(
    fn: () => unknown,
    condition?: (e: unknown) => boolean,
    conditionExplanation?: string
) {
    try {
        await Promise.resolve(fn());
        assert.fail("No error was thrown");
    } catch (e) {
        if (condition && !condition(e)) {
            assert.fail(
                "Something was thrown, but did not satisfy condition" +
                    (conditionExplanation ? `: ${conditionExplanation}` : "")
            );
        }
    }
}
