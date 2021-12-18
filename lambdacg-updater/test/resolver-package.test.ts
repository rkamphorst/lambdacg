import {ResolverPackage} from "lambdacg-updater/resolver-package";
import {describeClass,describeMember} from "./lib/mocha-utils";
import {createReadStream, createWriteStream} from "node:fs";
import {finished as streamFinised } from "node:stream";
import {promisify} from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import fsu from "lambdacg-updater/fs-utils";
import {expect} from "chai";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import unzipper from "unzipper";

const streamFinishedAsync = promisify(streamFinised);

let debugTestCallback: ((message: string) => void) | undefined = undefined; //message => console.log(message);

const debugTest: (message: string) => void = (message) => {
    if (debugTestCallback) {
        debugTestCallback(message);
    }
};

describe("ResolverPackage", function() {

    const getMyPackageStream = () => createReadStream(path.join(__dirname, "data", "resolver-package.test", "my-package.tgz"));
    const getModuleStream = (tgzFile:string) => createReadStream(path.join(__dirname, "data", "resolver-package.test", tgzFile));


    describeClass({ResolverPackage}, function() {

        this.timeout('15s');
        this.slow('7s');

        let tmpDir:string|undefined = undefined;
        const codeZipPath = () => path.join(`${tmpDir}`, "code.zip");
        const codeUnpackPath = () => path.join(`${tmpDir}`, "unpack");
        const myPackageIndexPath = () =>  path.join(codeUnpackPath(), "index.js");
        const myPackagePackageJsonPath = () =>  path.join(codeUnpackPath(), "package.json");
        const myPackageModulePath = (moduleName:string) => path.join(codeUnpackPath(), "node_modules", moduleName);


        beforeEach(async () => {
            tmpDir = await createTemporaryDirAsync();
            debugTest(`Created tmp directory "${tmpDir}"`);
        });

        afterEach(async () => {
            if (tmpDir) {
                try {
                    await fs.rm(tmpDir, { force:true, recursive:true});
                    debugTest(`Deleted tmp directory "${tmpDir}"`);
                } catch (err) {
                    debugTest(`Deleting tmp directory "${tmpDir}" failed.`)
                }

            }
            tmpDir = undefined;
        });

        describeMember<ResolverPackage>("createLambdaCodeZipStream", function() {
            it("Should create a correct zip file if no modules are added", async function() {

                debugTest("TMP DIR IS "+ tmpDir);
                const sut = new ResolverPackage(getMyPackageStream);

                const toStream = createWriteStream(codeZipPath());
                sut.createLambdaCodeZipStream().pipe(toStream);

                await streamFinishedAsync(toStream);

                expect(await fsu.fileExistsAsync(codeZipPath())).to.be.true;

                const readStream = createReadStream(codeZipPath());
                const writeStream = unzipper.Extract({ path: codeUnpackPath() });
                readStream.pipe(writeStream);

                const promise = new Promise<void>((resolve, reject) => {
                    if (writeStream.writableFinished) {
                        resolve();
                    } else {
                        writeStream.on('close', (err:unknown) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    }

                });
                await promise;

                expect (await fsu.fileExistsAsync(myPackageIndexPath()), "index.js exists").to.be.true;
                expect (await fsu.fileExistsAsync(myPackagePackageJsonPath()), "package.json exists").to.be.true;

                const packageInfo =
                    JSON.parse((await fs.readFile(myPackagePackageJsonPath())).toString('utf-8')) as {[key:string]:unknown};

                expect (packageInfo["name"]).to.be.equal("my-package");
            });

            it("Should create a correct zip file if multiple modules are added", async function() {

                const sut = new ResolverPackage(getMyPackageStream);

                sut.addHandlerFromTarballStream("MyModule.tar.gz", getModuleStream("my-module.tgz"));
                sut.addHandlerFromTarballStream("HerModule.tar.gz", getModuleStream("her-module.tgz"));
                sut.addHandlerFromTarballStream("HisModule.tar.gz", getModuleStream("his-module.tgz"));

                const toStream = createWriteStream(codeZipPath());
                sut.createLambdaCodeZipStream().pipe(toStream);

                await streamFinishedAsync(toStream);

                expect(await fsu.fileExistsAsync(codeZipPath())).to.be.true;

                const readStream = createReadStream(codeZipPath());
                const writeStream = unzipper.Extract({ path: codeUnpackPath() });

                readStream.pipe(writeStream);

                const promise = new Promise<void>((resolve, reject) => {
                    if (writeStream.writableFinished) {
                        resolve();
                    } else {
                        writeStream.on('close', (err:unknown) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    }

                });
                await promise;
                //await streamFinishedAsync(writeStream);

                expect (await fsu.fileExistsAsync(myPackageIndexPath()), "index.js exists").to.be.true;
                expect (await fsu.fileExistsAsync(myPackagePackageJsonPath()), "package.json exists").to.be.true;

                const packageInfo =
                    JSON.parse((await fs.readFile(myPackagePackageJsonPath())).toString('utf-8')) as {[key:string]:unknown};

                expect (packageInfo["name"]).to.be.equal("my-package");

                expect(await fsu.directoryExistsAsync(myPackageModulePath("my-module")), "my-module is installed").to.be.true;
                expect(await fsu.directoryExistsAsync(myPackageModulePath("her-module")), "her-module is installed").to.be.true;
                expect(await fsu.directoryExistsAsync(myPackageModulePath("his-module")), "his-module is installed").to.be.true;


            });

        });

        describeMember<ResolverPackage>("cleanupAsync", function() {
            it("Should clean up all the mess", function() {
                this.skip();
            });
        });

    });
});

