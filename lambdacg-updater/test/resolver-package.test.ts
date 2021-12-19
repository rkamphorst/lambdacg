import { ResolverPackage } from "lambdacg-updater/resolver-package";
import { npmInstallAsync } from "lambdacg-updater/npm-utils";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "chai";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import unzipper from "unzipper";
import { isWriteStreamFinishedAsync } from "./lib/stream-utils";
import { getLogger } from "./lib/logger";
import mockFs from "mock-fs";
import {
    expectDirectoryToExistAsync,
    expectFileToExistAsync,
} from "./lib/expect-file-to-exist";
import os from "node:os";

const logger = getLogger();

const dataDir = path.join(__dirname, "data", "resolver-package.test");

describe("ResolverPackage", function () {
    const getMyPackageStream = () =>
        createReadStream(path.join(dataDir, "my-package.tgz"));
    const getModuleStream = (tgzFile: string) =>
        createReadStream(path.join(dataDir, tgzFile));

    describeClass({ ResolverPackage }, function () {
        this.timeout("15s");
        this.slow("7s");

        let tmpDir: string | undefined = undefined;
        const codeUnpackPath = () => path.join(`${tmpDir}`, "unpack");

        beforeEach(async () => {
            tmpDir = await createTemporaryDirAsync();
            logger.log(`Created tmp directory "${tmpDir}"`);
        });

        afterEach(async () => {
            if (tmpDir) {
                try {
                    await fs.rm(tmpDir, { force: true, recursive: true });
                    logger.log(`Deleted tmp directory "${tmpDir}"`);
                } catch (err) {
                    logger.log(`Deleting tmp directory "${tmpDir}" failed.`);
                }
            }
            tmpDir = undefined;
        });

        describeMember<ResolverPackage>(
            "createLambdaCodeZipStream",
            function () {
                it("Should create a correct zip file if no modules are added", async function () {
                    const sut = new ResolverPackage(
                        getMyPackageStream,
                        npmInstallAsync
                    );

                    await isWriteStreamFinishedAsync(
                        sut.createLambdaCodeZipStream().pipe(
                            unzipper.Extract({
                                path: codeUnpackPath(),
                            })
                        )
                    );

                    await expectFileToExistAsync("index.js", codeUnpackPath());
                    await expectFileToExistAsync(
                        "package.json",
                        codeUnpackPath()
                    );

                    const packageInfo = JSON.parse(
                        (
                            await fs.readFile(
                                path.join(codeUnpackPath(), "package.json")
                            )
                        ).toString("utf-8")
                    ) as { [key: string]: unknown };

                    expect(packageInfo["name"]).to.be.equal("my-package");
                });

                it("Should create a correct zip file if multiple modules are added", async function () {
                    const sut = new ResolverPackage(
                        getMyPackageStream,
                        npmInstallAsync
                    );

                    sut.addHandlerFromTarballStream(
                        "MyModule.tar.gz",
                        getModuleStream("my-module.tgz")
                    );
                    sut.addHandlerFromTarballStream(
                        "HerModule.tar.gz",
                        getModuleStream("her-module.tgz")
                    );
                    sut.addHandlerFromTarballStream(
                        "HisModule.tar.gz",
                        getModuleStream("his-module.tgz")
                    );

                    await isWriteStreamFinishedAsync(
                        sut.createLambdaCodeZipStream().pipe(
                            unzipper.Extract({
                                path: codeUnpackPath(),
                            })
                        )
                    );

                    await expectFileToExistAsync("index.js", codeUnpackPath());
                    await expectFileToExistAsync(
                        "package.json",
                        codeUnpackPath()
                    );

                    const packageInfo = JSON.parse(
                        (
                            await fs.readFile(
                                path.join(codeUnpackPath(), "package.json")
                            )
                        ).toString("utf-8")
                    ) as { [key: string]: unknown };

                    expect(packageInfo["name"]).to.be.equal("my-package");

                    await expectDirectoryToExistAsync(
                        "node_modules/my-module",
                        codeUnpackPath()
                    );
                    await expectDirectoryToExistAsync(
                        "node_modules/her-module",
                        codeUnpackPath()
                    );
                    await expectDirectoryToExistAsync(
                        "node_modules/his-module",
                        codeUnpackPath()
                    );
                });
            }
        );

        describeMember<ResolverPackage>("cleanupAsync", function () {
            before(function () {
                mockFs(
                    {
                        [dataDir]: mockFs.load(dataDir),
                    },
                    {
                        createTmp: true,
                    }
                );
            });

            after(function () {
                mockFs.restore();
            });

            it("Should cleanup temp files", async function () {
                // not using the real npm install, because it invokes npm in a seperate shell
                // that doesn't know about mockFs
                const sut = new ResolverPackage(getMyPackageStream, () =>
                    Promise.resolve()
                );

                sut.addHandlerFromTarballStream(
                    "MyModule.tar.gz",
                    getModuleStream("my-module.tgz")
                );

                await isWriteStreamFinishedAsync(
                    sut.createLambdaCodeZipStream().pipe(
                        unzipper.Extract({
                            path: codeUnpackPath(),
                        })
                    )
                );

                await sut.cleanupAsync();

                const dirContents = await fs.readdir(os.tmpdir());
                const relativeTmpDir = path.relative(
                    os.tmpdir(),
                    tmpDir as string
                );

                expect(
                    dirContents,
                    "only the test tmp dir is still there"
                ).to.have.deep.members([relativeTmpDir]);
            });
        });
    });
});
