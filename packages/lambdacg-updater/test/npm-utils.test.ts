import { expect } from "chai";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from "stream";
import streamEqualAsync from "stream-equal";

import {
    npmInstallAsync,
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync,
} from "../src/npm-utils";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import { expectFileToExistAsync } from "./lib/expect-file-to-exist";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

const dataDir = path.join(__dirname, "data", "npm-utils.test");

describe("NpmUtils", function () {
    // these tests are relatively slow (because of reading from fs)
    // therefore we adjust the timeouts
    this.slow("200ms");
    this.timeout("60s");

    describeObject({ npmInstallAsync }, function () {
        let tmpdir: string | undefined = undefined;
        before(async function () {
            tmpdir = await createTemporaryDirAsync();
        });

        after(async function () {
            await fs.rm(tmpdir as string, { force: true, recursive: true });
        });

        it(`Should install valid package`, async function () {
            const packagePath = path.join(dataDir, "validpackage.tgz");
            await npmInstallAsync(tmpdir as string, [packagePath]);
        });

        it(`Should throw error if file does not exist`, async function () {
            const packagePath = path.join(dataDir, "nonexistent.tgz");
            await expectToThrowAsync(() =>
                npmInstallAsync(tmpdir as string, [packagePath])
            );
        });
    });

    describeObject({ readNpmPackageInfoAsync }, function () {
        for (const validpackageTgz of [
            "validpackage1.tgz",
            "validpackage.tgz",
        ]) {
            const packagePath = path.join(dataDir, validpackageTgz);
            it(`Should read pakage.json from ${validpackageTgz}`, async function () {
                const readStream = createReadStream(packagePath);

                const packageInfo = await readNpmPackageInfoAsync(readStream);

                expect(packageInfo).to.be.deep.equal({
                    name: "valid-package-name",
                    version: "1.2.3",
                });
            });
        }

        for (const invalidPackageTgz of [
            "invalidpackage-wrong-layout.tgz",
            "invalidpackage-no-packagejson.tgz",
            "invalidpackage-invalid-packagejson.tgz",
        ]) {
            const packagePath = path.join(dataDir, invalidPackageTgz);

            it(`Should throw an exception when reading from ${invalidPackageTgz}`, async function () {
                const readStream = createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    readNpmPackageInfoAsync(readStream)
                );
            });
        }

        it("Should be usable while parallel stream is completely read", async function () {
            const packagePath = path.join(dataDir, "biggerpackage.tgz");
            const readStream = createReadStream(packagePath);
            const fileCopyStream = new PassThrough();
            const readInfoStream = new PassThrough();

            readStream.pipe(fileCopyStream);
            readStream.pipe(readInfoStream);

            try {
                const [packageInfo, streamsAreEqual] = await Promise.all([
                    readNpmPackageInfoAsync(readInfoStream),
                    streamEqualAsync(
                        fileCopyStream,
                        createReadStream(packagePath)
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
                const readStream = createReadStream(packagePath);

                const result = await storeTemporaryNpmTarballAsync(readStream);

                await expectFileToExistAsync(result.location);

                const streamsAreEqual = await streamEqualAsync(
                    createReadStream(packagePath),
                    createReadStream(result.location)
                );

                expect(streamsAreEqual).to.be.true;
                expect(result.info).to.be.deep.equal({
                    name: "valid-package-name",
                    version: "1.2.3",
                });

                await fs.rm(result.location, { force: true });
            });
        }

        for (const invalidPackageTgz of [
            "invalidpackage-wrong-layout.tgz",
            "invalidpackage-no-packagejson.tgz",
            "invalidpackage-invalid-packagejson.tgz",
        ]) {
            const packagePath = path.join(dataDir, invalidPackageTgz);
            it(`Should refuse to store ${invalidPackageTgz} and throw an exception`, async function () {
                const readStream = createReadStream(packagePath);

                await expectToThrowAsync(() =>
                    storeTemporaryNpmTarballAsync(readStream)
                );
            });
        }

        it("Should throw if target directory does not exist", async function () {
            const packagePath = path.join(dataDir, "validpackage.tgz");
            const readStream = createReadStream(packagePath);

            await expectToThrowAsync(() =>
                storeTemporaryNpmTarballAsync(
                    readStream,
                    path.join(dataDir, "nonexistent")
                )
            );
        });
    });
});
