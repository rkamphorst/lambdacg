import { AWSError, Lambda, Request } from "aws-sdk";
import { expect } from "chai";
import sinon from "sinon";
import { PassThrough } from "stream";

import { LambdaUpdateTarget } from "../src/lambda-update-target";
import { ResolverCodeZip, ResolverPackageInfo } from "../src/updater-contract";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { LambdaClientMock } from "./lib/lambda-client-mock";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { S3ClientMock } from "./lib/s3-client-mock";

describe("LambdaUpdateTarget", async function () {
    describeClass({ LambdaUpdateTarget }, function () {
        describeMember<LambdaUpdateTarget>("updateCodeAsync", function () {
            const parameters = [
                {
                    mainFile: "index.js",
                    handlerFactories: ["a", "b", "c"],
                    expectHandlerFactoriesEnv: "a,b,c",
                    expectHandler: "index.handler",
                },
                {
                    mainFile: "dist/index.js",
                    handlerFactories: ["h-1", "h-2", "h-3"],
                    expectHandlerFactoriesEnv: "h-1,h-2,h-3",
                    expectHandler: "dist/index.handler",
                },
                {
                    mainFile: "dist/index",
                    handlerFactories: ["h-1", "h-2", "h-3"],
                    expectHandlerFactoriesEnv: "h-1,h-2,h-3",
                    expectHandler: "dist/index.handler",
                },
                {
                    mainFile: "dist/index",
                    handlerFactories: ["h-1", "h-2", "h-3"],
                    expectHandlerFactoriesEnv: "h-1,h-2,h-3",
                    expectHandler: "dist/index.handler",
                },
            ];

            for (const {
                mainFile,
                handlerFactories,
                expectHandlerFactoriesEnv,
                expectHandler,
            } of parameters) {
                it(`Should update lambda with handler=${expectHandler} and factories=${expectHandlerFactoriesEnv}`, async function () {
                    // Arrange
                    const lambdaName = "lambdaName";
                    const s3Bucket = "s3Bucket";
                    const s3Folder = "s3Folder";

                    const stream = new PassThrough();
                    stream.end();
                    const packageInfo: ResolverPackageInfo = {
                        name: "resolver-package",
                        version: "1.0.0",
                        main: mainFile,
                    };

                    const lambdaClientMock = new LambdaClientMock();
                    const updateCodeSpy =
                        lambdaClientMock.setupUpdateFunctionCode(
                            lambdaName,
                            s3Bucket,
                            (pfx) => pfx.startsWith(`${s3Folder}/`)
                        );
                    lambdaClientMock.setupGetFunctionConfiguration(undefined);
                    const updateConfigSpy =
                        lambdaClientMock.setupUpdateFunctionConfiguration(
                            lambdaName,
                            expectHandlerFactoriesEnv,
                            expectHandler
                        );

                    const s3ClientMock = new S3ClientMock();
                    const uploadCodeSpy = s3ClientMock.setupUpload(
                        (v) => v.Bucket === s3Bucket
                    );

                    const sut = new LambdaUpdateTarget(
                        {
                            lambdaName: lambdaName,
                            s3FolderUrl: `s3://${s3Bucket}/${s3Folder}/`,
                        },
                        s3ClientMock.object,
                        lambdaClientMock.object
                    );

                    const codeZip: ResolverCodeZip = {
                        stream,
                        handlerFactories,
                        packageInfo,
                    };

                    // Act
                    await sut.updateCodeAsync(codeZip);

                    // Assert
                    sinon.assert.calledOnce(uploadCodeSpy);
                    sinon.assert.calledOnce(updateCodeSpy);
                    sinon.assert.calledOnce(updateConfigSpy);
                });
            }

            it("Should wait until lambda is ready before updating", async function () {
                // Arrange
                const lambdaName = "lambdaName";
                const s3Bucket = "s3Bucket";
                const s3Folder = "s3Folder";

                const stream = new PassThrough();
                stream.end();
                const handlerFactories = ["a", "b", "c"];
                const packageInfo: ResolverPackageInfo = {
                    name: "resolver-package",
                    version: "1.0.0",
                    main: "index.js",
                };

                const lambdaClientMock = new LambdaClientMock();
                const updateCodeSpy = lambdaClientMock.setupUpdateFunctionCode(
                    lambdaName,
                    s3Bucket,
                    (pfx) => pfx.startsWith(`${s3Folder}/`)
                );
                const getFunctionSpy = lambdaClientMock
                    .setupGetFunctionConfiguration(undefined)
                    .onCall(0)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "Successful",
                                State: "Inactive",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>)
                    .onCall(1)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "InProgress",
                                State: "Active",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>)
                    .onCall(2)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "Successful",
                                State: "Active",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>);

                const updateConfigSpy =
                    lambdaClientMock.setupUpdateFunctionConfiguration(
                        lambdaName,
                        "a,b,c",
                        "index.handler"
                    );

                const s3ClientMock = new S3ClientMock();
                const uploadCodeSpy = s3ClientMock.setupUpload(
                    (v) => v.Bucket === s3Bucket
                );

                const sut = new LambdaUpdateTarget(
                    {
                        lambdaName: lambdaName,
                        s3FolderUrl: `s3://${s3Bucket}/${s3Folder}/`,
                    },
                    s3ClientMock.object,
                    lambdaClientMock.object
                );
                sut.setAwaitReadinessParameters(300, 0);

                const codeZip: ResolverCodeZip = {
                    stream,
                    handlerFactories,
                    packageInfo,
                };

                // Act
                await sut.updateCodeAsync(codeZip);

                // Assert
                sinon.assert.calledOnce(uploadCodeSpy);
                sinon.assert.calledOnce(updateCodeSpy);
                sinon.assert.calledOnce(updateConfigSpy);
                expect(getFunctionSpy.callCount).to.be.at.least(4);
            });

            it("Should throw if lambda not ready in time", async function () {
                // Arrange
                const lambdaName = "lambdaName";
                const s3Bucket = "s3Bucket";
                const s3Folder = "s3Folder";

                const stream = new PassThrough();
                stream.end();
                const handlerFactories = ["a", "b", "c"];
                const packageInfo: ResolverPackageInfo = {
                    name: "resolver-package",
                    version: "1.0.0",
                    main: "index.js",
                };

                const lambdaClientMock = new LambdaClientMock();
                lambdaClientMock
                    .setupGetFunctionConfiguration(undefined)
                    .onCall(0)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "Successful",
                                State: "Inactive",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>)
                    .onCall(1)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "InProgress",
                                State: "InActive",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>)
                    .onCall(2)
                    .returns({
                        promise: () =>
                            Promise.resolve({
                                Handler: "handler",
                                FunctionName: "functionName",
                                LastUpdateStatus: "InProgress",
                                State: "InActive",
                            }),
                    } as Request<Lambda.FunctionConfiguration, AWSError>);

                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupUpload((v) => v.Bucket === s3Bucket);

                const sut = new LambdaUpdateTarget(
                    {
                        lambdaName: lambdaName,
                        s3FolderUrl: `s3://${s3Bucket}/${s3Folder}/`,
                    },
                    s3ClientMock.object,
                    lambdaClientMock.object
                );
                sut.setAwaitReadinessParameters(2, 0);

                const codeZip: ResolverCodeZip = {
                    stream,
                    handlerFactories,
                    packageInfo,
                };

                // Act
                await expectToThrowAsync(() => sut.updateCodeAsync(codeZip));
            });

            it("Should be resilient to unexpected lambda api response", async function () {
                // Arrange
                const lambdaName = "lambdaName";
                const s3Bucket = "s3Bucket";
                const s3Folder = "s3Folder";

                const stream = new PassThrough();
                stream.end();
                const handlerFactories = ["a", "b", "c"];
                const packageInfo: ResolverPackageInfo = {
                    name: "resolver-package",
                    version: "1.0.0",
                    main: "index.js",
                };

                const lambdaClientMock = new LambdaClientMock();
                const updateCodeSpy = lambdaClientMock.setupUpdateFunctionCode(
                    lambdaName,
                    s3Bucket,
                    (pfx) => pfx.startsWith(`${s3Folder}/`)
                );
                lambdaClientMock
                    .setupGetFunctionConfiguration(undefined)
                    .onCall(0)
                    .returns({
                        promise: () => Promise.resolve({}),
                    } as Request<Lambda.FunctionConfiguration, AWSError>);

                const updateConfigSpy =
                    lambdaClientMock.setupUpdateFunctionConfiguration(
                        lambdaName,
                        "a,b,c",
                        "index.handler"
                    );

                const s3ClientMock = new S3ClientMock();
                const uploadCodeSpy = s3ClientMock.setupUpload(
                    (v) => v.Bucket === s3Bucket
                );

                const sut = new LambdaUpdateTarget(
                    {
                        lambdaName: lambdaName,
                        s3FolderUrl: `s3://${s3Bucket}/${s3Folder}/`,
                    },
                    s3ClientMock.object,
                    lambdaClientMock.object
                );
                sut.setAwaitReadinessParameters(10, 0);

                const codeZip: ResolverCodeZip = {
                    stream,
                    handlerFactories,
                    packageInfo,
                };

                // Act
                await sut.updateCodeAsync(codeZip);

                // Assert
                sinon.assert.calledOnce(uploadCodeSpy);
                sinon.assert.calledOnce(updateCodeSpy);
                sinon.assert.calledOnce(updateConfigSpy);
            });
        });
    });
});
