import path from "path";
import fs from "fs";
import {
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync,
} from "lambdacg-updater/npm-utils";
import { expect } from "chai";
import { PassThrough } from "stream";
import streamEqualAsync from "stream-equal";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

const dataDir = path.join(__dirname, "data", "npm-utils.test");

describe("NpmUtils", function () {
    // these tests are relatively slow (because of reading from fs)
    // therefore we adjust the timeouts
    this.slow("200ms");

    describeObject({ readNpmPackageInfoAsync }, function () {
        for (const validpackageTgz of [
            "validpackage1.tgz",
            "validpackage.tgz",
        ]) {
            const packagePath = path.join(dataDir, validpackageTgz);
            it(`Should read pakage.json from ${validpackageTgz}`, async function () {
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

            it(`Should throw an exception when reading from ${invalidPackageTgz}`, async function () {
                const readStream = fs.createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    readNpmPackageInfoAsync(readStream)
                );
            });
        }

        it("Should be usable while parallel stream is completely read", async function () {
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

    describeObject({ storeTemporaryNpmTarballAsync }, function () {
        for (const validpackageTgz of [
            "validpackage1.tgz",
            "validpackage.tgz",
        ]) {
            const packagePath = path.join(dataDir, validpackageTgz);
            it(`Should store ${validpackageTgz} and return package info`, async () => {
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
            it(`Should refuse to store ${invalidPackageTgz} and throw an exception`, async function () {
                const readStream = fs.createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    storeTemporaryNpmTarballAsync(readStream)
                );
            });
        }
    });
});
