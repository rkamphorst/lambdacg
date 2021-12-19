import { config as awsConfig, Lambda, S3, STS } from "aws-sdk";
import { Context } from "mocha";
import { v4 as uuid } from "uuid";

class AwsTestSession {
    #stsClient: STS;
    #lambdaClient: Lambda;
    #s3Client: S3;
    #awsAccount?: string;
    #awsRegion: string;
    #hasAwsCredentials?: boolean;
    #resourceNamePrefix: string;

    #tempS3Contents: { [key: string]: string[] } = {};
    #tempS3Buckets: string[] = [];
    #tempLambdas: string[] = [];

    #inform: (message: string) => void;

    constructor(
        inform: (message: string) => void,
        region?: string,
        resourceNamePrefix = "lambdacgtest-"
    ) {
        this.#awsRegion = region ?? "eu-west-1";
        awsConfig.update({ region: this.#awsRegion });
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
                CreateBucketConfiguration: {
                    LocationConstraint: this.#awsRegion,
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
            Object.keys(contents).map((key) =>
                this.#s3Client
                    .putObject({
                        Bucket: s3Bucket,
                        Key: key,
                        Body: contents[key],
                    })
                    .promise()
            )
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

    async createLambdaAsync(zipFileContents: Buffer) {
        const functionName = this.#generateName();

        await this.#lambdaClient
            .createFunction({
                FunctionName: functionName,
                Role: `arn:aws:iam::${
                    this.#awsAccount
                }:role/LambdaCgLambdaExecutionRole`,
                Runtime: "nodejs14.x",
                Handler: "index.handler",
                Code: {
                    ZipFile: zipFileContents,
                },
            })
            .promise();
        this.#tempLambdas.push(functionName);
        this.#inform(`Created lambda ${functionName}`);
        return functionName;
    }

    async createLambdaAndAwaitReadinessAsync(zipFileContents: Buffer) {
        const functionName = await this.createLambdaAsync(zipFileContents);

        await this.awaitLambdaReadiness(functionName);

        const response = await this.#lambdaClient
            .invoke({
                FunctionName: functionName,
                Payload: "{}",
            })
            .promise();
        this.#inform(
            `Invoked lambda ${functionName} -- response: ${response.Payload}`
        );

        return functionName;
    }

    async awaitLambdaReadiness(functionName: string) {
        let lastUpdateStatus: string | undefined = "__initial__";

        while ("Successful" !== lastUpdateStatus) {
            if (lastUpdateStatus !== "__initial__") {
                this.#inform(`Awaiting readiness of lambda ${functionName}`);
                await new Promise<void>((resolve) =>
                    setTimeout(() => resolve(), 1000)
                );
            }
            lastUpdateStatus = (
                await this.#lambdaClient
                    .getFunction({
                        FunctionName: functionName,
                    })
                    .promise()
            ).Configuration?.LastUpdateStatus;
        }
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
                    await this.#deleteS3BucketObjectsAsync(d);

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

    async #deleteS3BucketObjectsAsync(s3Bucket: string) {
        let continuation: string | undefined;
        let counter = 0;
        let deleteSuccessful = true;
        do {
            const response = await this.#s3Client
                .listObjectsV2({
                    Bucket: s3Bucket,
                    ContinuationToken: continuation,
                })
                .promise();

            const { Contents: contents, IsTruncated: isTruncated } = response;

            continuation = isTruncated ? response.ContinuationToken : undefined;

            if (contents) {
                await Promise.all(
                    contents.map(async (s3Obj) => {
                        if (s3Obj.Key) {
                            try {
                                await this.#s3Client
                                    .deleteObject({
                                        Bucket: s3Bucket,
                                        Key: s3Obj.Key,
                                    })
                                    .promise();
                                counter++;
                            } catch {
                                this.#inform(
                                    `Could not delete s3://${s3Bucket}/${s3Obj.Key}`
                                );
                                deleteSuccessful = false;
                            }
                        }
                    })
                );
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
