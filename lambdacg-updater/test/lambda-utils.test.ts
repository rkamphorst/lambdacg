import { assert } from "chai";
import fs from "node:fs/promises";
import path from "node:path";
import { AwsTestSession } from './aws-test-session';

const dataDir = path.join(__dirname, "data", "lambda-utils.test");

describe("LambdaUtils", async () => {

    const awsTestSession = new AwsTestSession(msg => console.log(msg), 'eu-west-1', 'lambdacgtest-');

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync())

    describe("updateLambdaFunctionWithDirectoryAsync", () => {
        before(async () => {
            if (awsTestSession.hasAwsCredentials()) {
                const zipFileContents = await fs.readFile(path.join(dataDir, "index.zip"));
                await awsTestSession.createLambdaAndAwaitReadinessAsync(zipFileContents);
            }
        });

        it("Empty test", awsTestSession.withAws(() => {


            assert.isTrue(true);
        }));
    })
});
