import sinon from "sinon";
import { PassThrough } from "stream";

import { LambdaUpdateTarget } from "../src/lambda-update-target";
import { LambdaClientMock } from "./lib/lambda-client-mock";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { S3ClientMock } from "./lib/s3-client-mock";

describe("LambdaUpdateTarget", async function () {
    describeClass({ LambdaUpdateTarget }, function () {
        describeMember<LambdaUpdateTarget>("updateCodeAsync", function () {
            it("Should successfully update a lambda function", async function () {
                // Arrange
                const lambdaName = "lambdaName";
                const s3Bucket = "s3Bucket";
                const s3Folder = "s3Folder";

                const lambdaClientMock = new LambdaClientMock();
                const updateCodeSpy = lambdaClientMock.setupUpdateFunctionCode(
                    lambdaName,
                    s3Bucket,
                    (pfx) => pfx.startsWith(`${s3Folder}/`)
                );

                const s3ClientMock = new S3ClientMock();
                const uploadCodeSpy = s3ClientMock.setupUpload(
                    (v) => v.Bucket === s3Bucket
                );

                const stream = new PassThrough();
                stream.end();

                const sut = new LambdaUpdateTarget(
                    {
                        lambdaName: lambdaName,
                        s3FolderUrl: `s3://${s3Bucket}/${s3Folder}/`,
                    },
                    s3ClientMock.object,
                    lambdaClientMock.object
                );

                // Act
                await sut.updateCodeAsync(stream);

                // Assert
                sinon.assert.calledOnce(uploadCodeSpy);
                sinon.assert.calledOnce(updateCodeSpy);
            });
        });
    });
});
