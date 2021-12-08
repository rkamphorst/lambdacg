import { expect } from "chai";
import fs from "node:fs/promises";
import path from "node:path";
import { AwsTestSession } from "./aws-test-session";
import { updateLambdaFunctionWithDirectoryAsync } from "lambdacg-updater/lambda-utils";

const debugTest: (message: string) => void = () => {};
const dataDir = path.join(__dirname, "data", "lambda-utils.test");

describe("LambdaUtils", async function () {
    const awsTestSession = new AwsTestSession(
        debugTest,
        "eu-west-1",
        "lambdacgtest-"
    );

    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and log slowness theshold
    this.timeout("12s");
    this.slow("8s");

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync());

    let lambdaFunction: string;
    let s3Bucket: string;

    describe("updateLambdaFunctionWithDirectoryAsync", function () {
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
                const tmpdir = await fs.mkdtemp("lambdacgtest-updatelambda-");
                await fs.writeFile(
                    path.join(tmpdir, "index.js"),
                    'exports.handler = async function() { return { result: "updated" }; };\n'
                );

                try {
                    await updateLambdaFunctionWithDirectoryAsync(
                        tmpdir,
                        lambdaFunction,
                        `s3://${s3Bucket}/`
                    );
                } finally {
                    await fs.rm(tmpdir, { recursive: true, force: true });
                }

                // await awsTestSession.awaitLambdaReadiness(lambdaFunction);

                // var response = await awsTestSession.lambdaClient()
                //     .invoke({FunctionName: lambdaFunction})
                //     .promise();

                // expect(JSON.parse(response.Payload as string)).to.be.deep.equal({result: "updated"});
            })
        );
    });
});
