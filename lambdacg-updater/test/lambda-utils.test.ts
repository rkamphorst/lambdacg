import archiver from "archiver";
import { expect } from "chai";
import { updateLambdaFunctionWithZipStreamAsync } from "lambdacg-updater/lambda-utils";
import fs from "node:fs/promises";
import path from "node:path";

import { AwsTestSession } from "./lib/aws-test-session";
import { createTemporaryDirAsync } from "./lib/create-temporary-dir";
import { getLogger } from "./lib/logger";
import { describeObject } from "./lib/mocha-utils";

const dataDir = path.join(__dirname, "data", "lambda-utils.test");
const logger = getLogger();

describe("LambdaUtils", async function () {
    const awsTestSession = new AwsTestSession(
        (m) => logger.log(m),
        "eu-west-1",
        "lambdacgtest-"
    );

    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and long slowness theshold
    this.timeout("15s");
    this.slow("10s");

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync());

    let lambdaFunction: string;
    let s3Bucket: string;

    describeObject({ updateLambdaFunctionWithZipStreamAsync }, function () {
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

                try {
                    await updateLambdaFunctionWithZipStreamAsync(
                        archive,
                        lambdaFunction,
                        `s3://${s3Bucket}/`
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
