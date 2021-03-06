import { AWSError, Lambda, S3, STS } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { Context } from "mocha";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

class AwsTestSession {
    #stsClient: STS;
    #lambdaClient: Lambda;
    #s3Client: S3;
    #awsAccount?: string;
    #hasAwsCredentials?: boolean;
    #resourceNamePrefix: string;

    #tempS3Contents: { [key: string]: string[] } = {};
    #tempS3Buckets: string[] = [];
    #tempLambdas: string[] = [];

    #inform: (message: string) => void;

    constructor(
        inform: (message: string) => void,
        resourceNamePrefix = "lambdacgtest-"
    ) {
        this.#stsClient = new STS();
        this.#lambdaClient = new Lambda();
        this.#s3Client = new S3();
        this.#hasAwsCredentials = undefined;
        this.#resourceNamePrefix = resourceNamePrefix;
        this.#inform = inform;
    }

    get lambdaClient() {
        return this.#lambdaClient;
    }

    get s3Client() {
        return this.#s3Client;
    }

    hasAwsCredentials() {
        return this.#hasAwsCredentials ?? false;
    }

    async initializeAsync() {
        try {
            this.#awsAccount = (
                await this.#stsClient.getCallerIdentity().promise()
            ).Account;
            this.#hasAwsCredentials = true;
            this.#inform("Valid AWS credentials found");
        } catch {
            this.#hasAwsCredentials = false;
            this.#inform("No valid AWS credentials found");
        }
    }

    withAws(test: (this: Context) => void | Promise<void>) {
        /* eslint-disable @typescript-eslint/no-this-alias */
        const session = this;
        return function (this: Context) {
            if (!session.#hasAwsCredentials) {
                this.skip();
            }
            return test.call(this);
        };
        /* eslint-enable @typescript-eslint/no-this-alias */
    }

    async createS3BucketAsync() {
        const s3Bucket: string = this.#generateName();
        await this.#s3Client
            .createBucket({
                Bucket: s3Bucket,
            })
            .promise();

        await this.#s3Client
            .putBucketVersioning({
                Bucket: s3Bucket,
                VersioningConfiguration: {
                    Status: "Enabled",
                },
            })
            .promise();

        this.#tempS3Buckets.push(s3Bucket);
        this.#inform(`Created s3 bucket ${s3Bucket}`);
        return s3Bucket;
    }

    async createS3BucketWithContentsAsync(contents: { [key: string]: string }) {
        const s3Bucket = await this.createS3BucketAsync();

        await Promise.all(
            Object.keys(contents).map(async (key) => {
                await this.uploadS3ObjectAsync(s3Bucket, key, contents[key]);
            })
        );
        if (!(s3Bucket in this.#tempS3Contents)) {
            this.#tempS3Contents[s3Bucket] = [];
        }
        this.#tempS3Contents[s3Bucket].push(...Object.keys(contents));

        this.#inform(
            `Uploaded ${
                Object.keys(contents).length
            } objects to s3 bucket ${s3Bucket}`
        );
        return s3Bucket;
    }

    async uploadS3ObjectAsync(
        s3Bucket: string,
        key: string,
        content: string | Readable
    ): Promise<void> {
        await this.#s3Client
            .putObject({
                Bucket: s3Bucket,
                Key: key,
                Body: content,
            })
            .promise();
    }

    async deleteS3ObjectAsync(s3Bucket: string, key: string): Promise<void> {
        await this.#s3Client
            .deleteObject({
                Bucket: s3Bucket,
                Key: key,
            })
            .promise();
    }

    emptyS3BucketAsync(s3Bucket: string) {
        return this.#deleteS3BucketObjectVersionsAsync(s3Bucket);
    }

    async createLambdaAsync(zipFileContents: Buffer, handler: string) {
        const functionName = this.#generateName();

        await this.#lambdaClient
            .createFunction({
                FunctionName: functionName,
                Role: `arn:aws:iam::${
                    this.#awsAccount
                }:role/LambdaCgLambdaExecutionRole`,
                Runtime: "nodejs14.x",
                Handler: handler,
                Code: {
                    ZipFile: zipFileContents,
                },
            })
            .promise();
        this.#tempLambdas.push(functionName);
        this.#inform(`Created lambda ${functionName}`);

        return functionName;
    }

    async updateLambdaCodeAsync(
        functionName: string,
        zipFileContents: Buffer,
        handler: string
    ) {
        let config = await this.awaitLambdaReadiness(functionName);
        const revisionId = config?.RevisionId;

        if (handler !== config?.Handler) {
            await this.#lambdaClient
                .updateFunctionConfiguration({
                    FunctionName: functionName,
                    Handler: handler,
                    RevisionId: revisionId,
                })
                .promise();

            this.#inform(
                `Updated handler to "${handler}" for lambda ${functionName}`
            );

            config = await this.awaitLambdaReadiness(functionName);
        }

        await this.#lambdaClient
            .updateFunctionCode({
                FunctionName: functionName,
                ZipFile: zipFileContents,
                RevisionId: revisionId,
            })
            .promise();

        this.#inform(`Updated function code for lambda ${functionName}`);
    }

    async updateLambdaCodeAndAwaitReadinessAsync(
        functionName: string,
        zipFileContents: Buffer,
        handler: string
    ) {
        await this.updateLambdaCodeAsync(
            functionName,
            zipFileContents,
            handler
        );
        await this.awaitLambdaReadiness(functionName);
    }

    async createLambdaAndAwaitReadinessAsync(
        zipFileContents: Buffer,
        handler: string
    ) {
        const functionName = await this.createLambdaAsync(
            zipFileContents,
            handler
        );

        await this.awaitLambdaReadiness(functionName);

        return functionName;
    }

    async awaitLambdaReadiness(functionName: string) {
        const maxIterations = 300;
        let lastUpdateStatus = "__initial__";
        let state = "__initial__";
        let configuration: Lambda.FunctionConfiguration | undefined = undefined;

        let iterations = 0;

        while ("Successful" !== lastUpdateStatus || "Active" !== state) {
            iterations++;
            if (iterations > maxIterations) {
                throw Error(
                    `Awaited lambda readiness for more than ${maxIterations} iterations`
                );
            }

            if (lastUpdateStatus !== "__initial__") {
                this.#inform(`Awaiting readiness of lambda ${functionName}`);
                await new Promise<void>((resolve) =>
                    setTimeout(() => resolve(), 2000)
                );
            }

            configuration = (
                await this.#lambdaClient
                    .getFunction({
                        FunctionName: functionName,
                    })
                    .promise()
            ).Configuration;

            lastUpdateStatus = configuration?.LastUpdateStatus ?? "__unknown__";
            state = configuration?.State ?? "__unknown__";
        }
        return configuration;
    }

    async invokeJsonLambdaAsync(functionName: string, payload: unknown) {
        const payloadStr = JSON.stringify(payload);
        const resultStr = await this.invokeLambdaAsync(
            functionName,
            payloadStr
        );

        if (resultStr) {
            return JSON.parse(resultStr);
        }
        throw Error("Lambda response is undefined");
    }

    async invokeLambdaAsync(functionName: string, payload: string) {
        const response = await this.#lambdaClient
            .invoke({
                FunctionName: functionName,
                Payload: payload,
            })
            .promise();

        return response.Payload?.toString();
    }

    async cleanupAsync() {
        await Promise.all([
            this.#cleanupLambdasAsync(),
            this.#cleanupS3BucketsAsync(),
        ]);
    }

    async #cleanupLambdasAsync() {
        // copy the temp lambdas array
        const toDelete = [...this.#tempLambdas];

        if (toDelete.length == 0) {
            return;
        }

        // clear the temp lambdas array
        this.#tempLambdas.length = 0;

        // delete all lambdas
        await Promise.all(
            toDelete.map((fn) =>
                this.#lambdaClient
                    .deleteFunction({ FunctionName: fn })
                    .promise()
            )
        );
        this.#inform(`Deleted ${toDelete.length} lambda function(s)`);
    }

    async #cleanupS3BucketsAsync() {
        await this.#cleanupS3ContentsAsync();

        const toDelete = [...this.#tempS3Buckets];

        if (toDelete.length == 0) {
            return;
        }

        this.#tempS3Buckets.length = 0;

        let counter = 0;
        let deleteBucketSuccess = true;
        await Promise.all(
            toDelete.map(async (d) => {
                const deleteObjectsSuccess =
                    await this.#deleteS3BucketObjectVersionsAsync(d);

                if (!deleteObjectsSuccess) {
                    this.#inform(
                        `Not all objects were deleted, cannot delete s3 bucket ${d}`
                    );
                    deleteBucketSuccess = false;
                    return;
                }

                await this.#s3Client.deleteBucket({ Bucket: d }).promise();
                counter++;
            })
        );

        this.#inform(`Deleted ${counter} s3 bucket(s)`);
        return deleteBucketSuccess;
    }

    async #deleteS3BucketObjectVersionsAsync(
        s3Bucket: string,
        prefix?: string
    ) {
        let continuation: string | undefined;
        let counter = 0;
        let deleteSuccessful = true;

        let continuationToken:
            | {
                  KeyMarker: string | undefined;
                  VersionIdMarker: string | undefined;
              }
            | undefined = undefined;

        do {
            const listVersionsResult: PromiseResult<
                S3.ListObjectVersionsOutput,
                AWSError
            > = await this.#s3Client
                .listObjectVersions({
                    Bucket: s3Bucket,
                    Prefix: prefix,
                    ...continuationToken,
                })
                .promise();

            const deleteMarkers = listVersionsResult.DeleteMarkers;
            const versions = listVersionsResult.Versions;

            await Promise.all([
                ...[...(versions ?? []), ...(deleteMarkers ?? [])].map(
                    async (s3ObjVersion) => {
                        if (s3ObjVersion.Key) {
                            try {
                                await this.#s3Client
                                    .deleteObject({
                                        Bucket: s3Bucket,
                                        Key: s3ObjVersion.Key,
                                        VersionId: s3ObjVersion.VersionId,
                                    })
                                    .promise();
                                counter++;
                            } catch {
                                this.#inform(
                                    `Could not delete s3://${s3Bucket}/${s3ObjVersion.Key}@${s3ObjVersion.VersionId}`
                                );
                                deleteSuccessful = false;
                            }
                        }
                    }
                ),
            ]);

            if (listVersionsResult.IsTruncated) {
                continuationToken = {
                    KeyMarker: listVersionsResult.NextKeyMarker,
                    VersionIdMarker: listVersionsResult.NextVersionIdMarker,
                };
            } else {
                continuationToken = undefined;
            }
        } while (continuation);

        if (counter > 0) {
            this.#inform(
                `Deleted ${counter} untracked object(s) from s3 bucket ${s3Bucket}`
            );
        }
        return deleteSuccessful;
    }

    async #cleanupS3ContentsAsync() {
        const toDelete = Object.keys(this.#tempS3Contents)
            .map((bucket) =>
                this.#tempS3Contents[bucket].map(
                    (key) =>
                        ({ Bucket: bucket, Key: key } as S3.DeleteObjectRequest)
                )
            )
            .reduce((p1, p2) => p1.concat(p2), []);

        if (toDelete.length == 0) {
            return;
        }

        for (const key of Object.keys(this.#tempS3Contents)) {
            this.#tempS3Contents[key].length = 0;
        }

        await Promise.all(
            toDelete.map((d) => this.#s3Client.deleteObject(d).promise())
        );
        this.#inform(`Deleted ${toDelete.length} tracked S3 object(s)`);
    }

    #generateName() {
        return `${this.#resourceNamePrefix}${uuid()}`;
    }
}

export { AwsTestSession };
