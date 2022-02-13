import { Lambda, S3 } from "aws-sdk";
import { v4 as uuid } from "uuid";

import { getBucketAndPrefixFromS3FolderUrl } from "./s3-utils";
import { ResolverCodeZip, UpdateTargetInterface } from "./updater-contract";

const getHandlerFromMain = (main: string) => {
    const mainExtension = main.match(/\.(js|mjs|cjs|ts|tsx)$/);
    if (mainExtension) {
        main = main.slice(0, -mainExtension[0].length);
    }
    const handler = `${main}.handler`;
    return handler;
};

type LambdaUpdateTargetConfig = {
    lambdaName: string;
    s3FolderUrl: string;
};

class LambdaUpdateTarget implements UpdateTargetInterface {
    #s3FolderUrl: string;
    #lambdaName: string;
    #s3Client: S3;
    #lambdaClient: Lambda;
    #awaitReadinesIterations: number;
    #awaitReadinessDelayMs: number;

    constructor(
        config: LambdaUpdateTargetConfig,
        s3Client: S3,
        lambdaClient: Lambda
    ) {
        this.#lambdaName = config.lambdaName;
        this.#s3FolderUrl = config.s3FolderUrl;
        this.#s3Client = s3Client;
        this.#lambdaClient = lambdaClient;
        this.#awaitReadinesIterations = 300;
        this.#awaitReadinessDelayMs = 2000;
    }

    setAwaitReadinessParameters(iterations: number, delayMs: number) {
        this.#awaitReadinesIterations = iterations;
        this.#awaitReadinessDelayMs = delayMs;
    }

    async updateCodeAsync(codeZip: ResolverCodeZip): Promise<void> {
        const { Bucket: s3Bucket, Prefix: s3Prefix } =
            await getBucketAndPrefixFromS3FolderUrl(this.#s3FolderUrl);
        const s3Key = `${s3Prefix}lambdacg-resolver-${uuid()}.zip`;

        await this.#s3Client
            .upload({
                Bucket: s3Bucket,
                Key: s3Key,
                Body: codeZip.stream,
            })
            .promise();

        let { RevisionId: revisionId } = await this.#awaitLambdaReadiness();

        ({ RevisionId: revisionId } = await this.#lambdaClient
            .updateFunctionCode({
                FunctionName: this.#lambdaName,
                S3Bucket: s3Bucket,
                S3Key: s3Key,
                RevisionId: revisionId,
            })
            .promise());

        ({ RevisionId: revisionId } = await this.#awaitLambdaReadiness());

        ({ RevisionId: revisionId } = await this.#lambdaClient
            .updateFunctionConfiguration({
                FunctionName: this.#lambdaName,
                RevisionId: revisionId,
                Handler: getHandlerFromMain(codeZip.packageInfo.main),
                Environment: {
                    Variables: {
                        HANDLER_FACTORIES: codeZip.handlerFactories.join(","),
                    },
                },
            })
            .promise());
    }

    async #awaitLambdaReadiness() {
        const maxIterations = this.#awaitReadinesIterations;
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
                await new Promise<void>((resolve) =>
                    setTimeout(resolve, this.#awaitReadinessDelayMs)
                );
            }

            configuration = await this.#lambdaClient
                .getFunctionConfiguration({
                    FunctionName: this.#lambdaName,
                })
                .promise();

            lastUpdateStatus = configuration.LastUpdateStatus ?? "__unknown__";
            state = configuration.State ?? "__unknown__";
        }
        return configuration as Lambda.FunctionConfiguration;
    }
}

export { LambdaUpdateTarget, LambdaUpdateTargetConfig };
