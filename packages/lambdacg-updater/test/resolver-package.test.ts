import { expect } from "chai";
import mockFs from "mock-fs";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import unzipper from "unzipper";

import { npmInstallAsync } from "../src/npm-utils";
import { ResolverPackage } from "../src/resolver-package";
import { streamFinishedAsync } from "../src/stream-utils";
import { RepositoryTarballInterface } from "../src/updater-contract";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import {
    expectDirectoryToExistAsync,
    expectFileToExistAsync,
} from "./lib/expect-file-to-exist";
import { expectToThrow, expectToThrowAsync } from "./lib/expect-to-throw";
import { getLogger } from "./lib/logger";
import { describeClass, describeMember } from "./lib/mocha-utils";

const logger = getLogger();

const dataDir = path.join(__dirname, "data", "resolver-package.test");

class StubHandlerTarball implements RepositoryTarballInterface {
    #name: string;
    #stream: () => Readable;

    constructor(name: string, stream: () => Readable) {
        this.#name = name;
        this.#stream = stream;
    }

    get name(): string {
        return this.#name;
    }
    getDownloadStream(): Readable {
        return this.#stream();
    }
}

const unzipZipStreamAsync = async (stream: Readable, unpackPath: string) => {
    const unzipStream = unzipper.Extract({
        path: unpackPath,
    });
    stream.pipe(unzipStream);
    try {
        await streamFinishedAsync(unzipStream);
    } catch (e) {
        if (
            e &&
            typeof e === "object" &&
            "code" in e &&
            (e as { code: unknown }).code === "ERR_STREAM_PREMATURE_CLOSE"
        ) {
            /* this is a nasty error that is thrown by the unzip stream, nothing to worry about... */
            stream.unpipe(unzipStream);
            stream.resume();
            return;
        }
        throw e;
    }
};

describe("ResolverPackage", function () {
    const getMyPackageStream = () =>
        createReadStream(path.join(dataDir, "my-package.tgz"));
    const getMyPackageNoMainStream = () =>
        createReadStream(path.join(dataDir, "my-package-no-main.tgz"));
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

        describeMember<ResolverPackage>("addHandlerTarball", function () {
            it("Should throw when tarball with same name was already added", function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    npmInstallAsync
                );

                sut.addHandlerTarball(
                    new StubHandlerTarball("MyModule.tar.gz", () =>
                        getModuleStream("my-module.tgz")
                    )
                );

                expectToThrow(() =>
                    sut.addHandlerTarball(
                        new StubHandlerTarball("MyModule.tar.gz", () =>
                            getModuleStream("my-module.tgz")
                        )
                    )
                );
            });
        });

        describeMember<ResolverPackage>("createCodeZipAsync", function () {
            it("Should create a correct zip file if no modules are added", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    npmInstallAsync
                );

                const { packageInfo, stream, handlerFactories } =
                    await sut.createCodeZipAsync();
                await unzipZipStreamAsync(stream, codeUnpackPath());

                await expectFileToExistAsync("index.js", codeUnpackPath());
                await expectFileToExistAsync("package.json", codeUnpackPath());

                const packageJson = JSON.parse(
                    (
                        await fs.readFile(
                            path.join(codeUnpackPath(), "package.json")
                        )
                    ).toString("utf-8")
                ) as { [key: string]: unknown };

                expect(packageJson["name"]).to.be.equal("my-package");
                expect(packageInfo.main).to.be.equal("index.js");
                expect(packageInfo.name).to.be.equal("my-package");
                expect(handlerFactories).to.have.deep.members([]);
            });

            it("Should create a correct zip file if package has no main entry", async function () {
                const sut = new ResolverPackage(
                    getMyPackageNoMainStream,
                    npmInstallAsync
                );

                const { packageInfo, stream, handlerFactories } =
                    await sut.createCodeZipAsync();
                await unzipZipStreamAsync(stream, codeUnpackPath());

                await expectFileToExistAsync("index.js", codeUnpackPath());
                await expectFileToExistAsync("package.json", codeUnpackPath());

                const packageJson = JSON.parse(
                    (
                        await fs.readFile(
                            path.join(codeUnpackPath(), "package.json")
                        )
                    ).toString("utf-8")
                ) as { [key: string]: unknown };

                expect(packageJson["name"]).to.be.equal("my-package-no-main");
                expect(packageInfo.main).to.be.equal("index");
                expect(packageInfo.name).to.be.equal("my-package-no-main");
                expect(handlerFactories).to.have.deep.members([]);
            });

            it("Should create a correct zip file if multiple modules are added", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    npmInstallAsync
                );

                sut.addHandlerTarball(
                    new StubHandlerTarball("MyModule.tar.gz", () =>
                        getModuleStream("my-module.tgz")
                    )
                );
                sut.addHandlerTarball(
                    new StubHandlerTarball("HerModule.tar.gz", () =>
                        getModuleStream("her-module.tgz")
                    )
                );
                sut.addHandlerTarball(
                    new StubHandlerTarball("HisModule.tar.gz", () =>
                        getModuleStream("his-module.tgz")
                    )
                );

                const {
                    packageInfo,
                    stream: zipStream,
                    handlerFactories,
                } = await sut.createCodeZipAsync();
                await unzipZipStreamAsync(zipStream, codeUnpackPath());

                await expectFileToExistAsync("index.js", codeUnpackPath());
                await expectFileToExistAsync("package.json", codeUnpackPath());

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

                expect(packageInfo.main).to.be.equal("index.js");
                expect(packageInfo.name).to.be.equal("my-package");
                expect(handlerFactories).to.have.deep.members([
                    "my-module",
                    "her-module",
                    "his-module",
                ]);
            });

            it("Should create a callable package if one module is added", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    npmInstallAsync
                );

                sut.addHandlerTarball(
                    new StubHandlerTarball("MyModule.tar.gz", () =>
                        getModuleStream("my-module.tgz")
                    )
                );

                const { stream: zipStream, handlerFactories } =
                    await sut.createCodeZipAsync();
                await unzipZipStreamAsync(zipStream, codeUnpackPath());

                process.env.HANDLER_FACTORIES = handlerFactories.join(",");
                const imported = (await import(
                    path.join(codeUnpackPath(), "index.js")
                )) as { handler: (message: string) => string[] };
                const importedFunction = imported.handler;
                const result = importedFunction("hello test one module");

                expect(result).to.have.members([
                    "my-module: hello test one module",
                ]);
            });

            it("Should create a callable package if three modules are added", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    npmInstallAsync
                );

                sut.addHandlerTarball(
                    new StubHandlerTarball("MyModule.tar.gz", () =>
                        getModuleStream("my-module.tgz")
                    )
                );
                sut.addHandlerTarball(
                    new StubHandlerTarball("HerModule.tar.gz", () =>
                        getModuleStream("her-module.tgz")
                    )
                );
                sut.addHandlerTarball(
                    new StubHandlerTarball("HisModule.tar.gz", () =>
                        getModuleStream("his-module.tgz")
                    )
                );

                const { stream: zipStream, handlerFactories } =
                    await sut.createCodeZipAsync();
                await unzipZipStreamAsync(zipStream, codeUnpackPath());

                process.env.HANDLER_FACTORIES = handlerFactories.join(",");
                const imported = (await import(
                    path.join(codeUnpackPath(), "index.js")
                )) as { handler: (message: string) => string[] };
                const importedFunction = imported.handler;
                const result = importedFunction("hello test three modules");

                expect(result).to.have.members([
                    "my-module: hello test three modules",
                    "her-module: hello test three modules",
                    "his-module: hello test three modules",
                ]);
            });

            it("Should throw an error if npm install throws an Error", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    async () => {
                        throw new Error("npm-install-error");
                    }
                );

                expectToThrowAsync(() => sut.createCodeZipAsync());
            });

            it("Should throw an error if npm install throws a string", async function () {
                const sut = new ResolverPackage(
                    getMyPackageStream,
                    async () => {
                        throw "npm-install-error";
                    }
                );

                expectToThrowAsync(() => sut.createCodeZipAsync());
            });
        });

        describeMember<ResolverPackage>("cleanupAsync", function () {
            beforeEach(function () {
                mockFs(
                    {
                        [dataDir]: mockFs.load(dataDir),
                    },
                    {
                        createTmp: true,
                    }
                );
            });

            afterEach(function () {
                mockFs.restore();
            });

            it("Should cleanup temp files", async function () {
                // Arrange

                // not using the real npm install, because it invokes npm in a seperate shell
                // that doesn't know about mockFs
                const sut = new ResolverPackage(getMyPackageStream, () =>
                    Promise.resolve()
                );

                sut.addHandlerTarball(
                    new StubHandlerTarball("MyModule.tar.gz", () =>
                        getModuleStream("my-module.tgz")
                    )
                );

                const { stream: zipStream } = await sut.createCodeZipAsync();

                zipStream.resume();
                await streamFinishedAsync(zipStream);

                // Act
                await sut.cleanupAsync();

                // Assert
                const dirContents = await fs.readdir(os.tmpdir());
                expect(dirContents, "tmp dir is empty").to.have.deep.members(
                    []
                );
            });

            it("Should not fail if nothing to clean up", async function () {
                // not using the real npm install, because it invokes npm in a seperate shell
                // that doesn't know about mockFs
                const sut = new ResolverPackage(getMyPackageStream, () =>
                    Promise.resolve()
                );

                await sut.cleanupAsync();

                const dirContents = await fs.readdir(os.tmpdir());

                expect(dirContents, "tmp dir is empty").to.have.deep.members(
                    []
                );
            });
        });
    });
});
