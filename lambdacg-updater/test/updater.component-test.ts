import { expect } from "chai";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "path";

import { AwsTestSession } from "./lib/aws-test-session";

const dataDir = path.join(__dirname, "data", "updater.component-test");

const myModuleName = "my-module";
const herModuleName = "her-module";
const hisModuleName = "his-module";

const getHandlerModuleTgzStream = (name: string) =>
    fs.createReadStream(path.join(dataDir, `${name}.tgz`));

describe("Updater (component test)", function () {
    // instal la very long timeout -- this can take a while!
    this.timeout("300s");
    this.slow("60s");

    const session = new AwsTestSession(() => {
        /*skip*/
    }, "lambdacg-updater-test-");

    let lambdaName = "undefined";
    let codeUploadBucket = "undefined";
    let handlerRepositoryBucket = "undefined";
    let invokeUpdaterAsync = () => Promise.resolve();

    before(async function () {
        await session.initializeAsync();
        [lambdaName, codeUploadBucket, handlerRepositoryBucket] =
            await Promise.all([
                session.createLambdaAndAwaitReadinessAsync(
                    await readFile(path.join(dataDir, "original.zip")),
                    "index.handler"
                ),
                session.createS3BucketAsync(),
                session.createS3BucketAsync(),
            ]);

        process.env[
            "S3_HANDLER_REPOSITORY"
        ] = `s3://${handlerRepositoryBucket}/`;
        process.env["S3_CODE_FOLDER"] = `s3://${codeUploadBucket}/`;
        process.env["TARGET_LAMBDA"] = lambdaName;

        const { handleAsync } = await import("../src/index");
        invokeUpdaterAsync = handleAsync;
    });

    beforeEach(async function () {
        await Promise.all([
            session.emptyS3BucketAsync(codeUploadBucket),
            session.emptyS3BucketAsync(handlerRepositoryBucket),
            session.updateLambdaCodeAndAwaitReadinessAsync(
                lambdaName,
                await readFile(path.join(dataDir, "original.zip")),
                "index.handler"
            ),
        ]);
    });

    after(async function () {
        await session.cleanupAsync();
    });

    it(
        "Should install nothing if empty repository",
        session.withAws(async function () {
            const expectedResponse = { result: "original" };

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should NOT have been updated
            const response = await session.invokeJsonLambdaAsync(
                lambdaName,
                {}
            );
            expect(response).to.deep.equal(expectedResponse);
        })
    );

    it(
        "Should install one module that is in repository",
        session.withAws(async function () {
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${myModuleName}.tgz`,
                getHandlerModuleTgzStream(myModuleName)
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should NOT have been updated
            const result = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test one module"
            );

            expect(result).to.have.members([
                "my-module: hello test one module",
            ]);
        })
    );

    it(
        "Should install multiple modules that are in repository",
        session.withAws(async function () {
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${myModuleName}.tgz`,
                getHandlerModuleTgzStream(myModuleName)
            );
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${herModuleName}.tgz`,
                getHandlerModuleTgzStream(herModuleName)
            );
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${hisModuleName}.tgz`,
                getHandlerModuleTgzStream(hisModuleName)
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should have been updated
            const result = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test three modules"
            );

            expect(result).to.have.members([
                "her-module: hello test three modules",
                "his-module: hello test three modules",
                "my-module: hello test three modules",
            ]);
        })
    );

    it(
        "Should update a module that is updated in repository",
        session.withAws(async function () {
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${myModuleName}.tgz`,
                getHandlerModuleTgzStream(myModuleName)
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should NOT have been updated
            const result1 = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test one module"
            );

            expect(result1).to.have.members([
                "my-module: hello test one module",
            ]);

            // exchange my-module.tgz with code from her-module.tgz, fake an update
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${myModuleName}.tgz`,
                getHandlerModuleTgzStream(herModuleName)
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should have been updated
            const result2 = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test one module"
            );

            expect(result2).to.have.members([
                "her-module: hello test one module",
            ]);
        })
    );

    it(
        "Should remove a module that is removed in repository",
        session.withAws(async function () {
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${myModuleName}.tgz`,
                getHandlerModuleTgzStream(myModuleName)
            );
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${herModuleName}.tgz`,
                getHandlerModuleTgzStream(herModuleName)
            );
            await session.uploadS3ObjectAsync(
                handlerRepositoryBucket,
                `${hisModuleName}.tgz`,
                getHandlerModuleTgzStream(hisModuleName)
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should have been updated
            const result1 = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test three modules"
            );

            expect(result1).to.have.members([
                "her-module: hello test three modules",
                "his-module: hello test three modules",
                "my-module: hello test three modules",
            ]);

            // exchange my-module.tgz with code from her-module.tgz, fake an update
            await session.deleteS3ObjectAsync(
                handlerRepositoryBucket,
                `${hisModuleName}.tgz`
            );

            await invokeUpdaterAsync();

            await session.awaitLambdaReadiness(lambdaName);

            // lambda should have been updated
            const result2 = await session.invokeJsonLambdaAsync(
                lambdaName,
                "hello test two modules"
            );

            expect(result2).to.have.members([
                "her-module: hello test two modules",
                "my-module: hello test two modules",
            ]);
        })
    );
});
