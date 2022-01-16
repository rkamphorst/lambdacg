import archiver from "archiver";
import { expect } from "chai";
import fs from "node:fs/promises";
import path from "node:path";

import { LambdaUpdateTarget, LambdaUpdateTargetConfig } from "../src/lambda-update-target";
import { AwsTestSession } from "./lib/aws-test-session";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import { getLogger } from "./lib/logger";
import { describeClass, describeMember, describeObject } from "./lib/mocha-utils";

const dataDir = path.join(__dirname, "data", "lambda-update-target.test");
const logger = getLogger();

describe("LambdaUpdateTarget", async function () {
    const awsTestSession = new AwsTestSession((m) => logger.log(m));

    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and long slowness theshold
    this.timeout("15s");
    this.slow("10s");

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync());

    let lambdaFunction: string;
    let s3Bucket: string;


    describeClass({ LambdaUpdateTarget }, function () {

        describeMember<LambdaUpdateTarget>("uploadCodeZipStreamAsync", function () {
            before(async () => {
                if (awsTestSession.hasAwsCredentials()) {
                    const zipFileContents = await fs.readFile(
                        path.join(dataDir, "index.zip")
                    );
                    lambdaFunction =
                        await awsTestSession.createLambdaAndAwaitReadinessAsync(
                            zipFileContents
                        );
                    s3Bucket = await awsTestSession.createS3BucketAsync();
                }
            });

            it(
                "Should successfully update a lambda function",
                awsTestSession.withAws(async function () {
                    const tmpdir = await createTemporaryDirAsync();
                    await fs.writeFile(
                        path.join(tmpdir, "index.js"),
                        'exports.handler = async function() { return { result: "updated" }; };\n'
                    );

                    const archive = archiver("zip");
                    archive.directory(tmpdir, false);
                    archive.finalize();

                    const sut = new LambdaUpdateTarget({
                        lambdaName: lambdaFunction,
                        s3FolderUrl: `s3://${s3Bucket}`
                    }, awsTestSession.s3Client, awsTestSession.lambdaClient)


                    try {
                        await sut.uploadCodeZipStreamAsync(
                            archive
                        );
                    } finally {
                        await fs.rm(tmpdir, { recursive: true, force: true });
                    }

                    await awsTestSession.awaitLambdaReadiness(lambdaFunction);

                    const response = await awsTestSession.lambdaClient
                        .invoke({ FunctionName: lambdaFunction })
                        .promise();

                    expect(JSON.parse(response.Payload as string)).to.be.deep.equal(
                        { result: "updated" }
                    );
                })
            );
        });
    });
});
