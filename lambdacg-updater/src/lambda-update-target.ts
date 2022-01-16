import { Lambda, S3 } from "aws-sdk";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { UpdateTargetInterface } from "./updater-contract";

import { getBucketAndPrefixFromS3FolderUrl } from "./s3-utils";

type LambdaUpdateTargetConfig = {
    lambdaName: string;
    s3FolderUrl: string;
}

class LambdaUpdateTarget implements UpdateTargetInterface {
    #s3FolderUrl: string;
    #lambdaName: string;
    #s3Client: S3;
    #lambdaClient: Lambda;

    constructor(config:LambdaUpdateTargetConfig, s3Client: S3, lambdaClient: Lambda) {
        this.#lambdaName = config.lambdaName;
        this.#s3FolderUrl = config.s3FolderUrl;
        this.#s3Client = s3Client;
        this.#lambdaClient = lambdaClient;
    }

    async uploadCodeZipStreamAsync(zipStream: Readable): Promise<void> {
        const { Bucket: s3Bucket, Prefix: s3Prefix } =
            await getBucketAndPrefixFromS3FolderUrl(this.#s3FolderUrl);
        const s3Key = `${s3Prefix}lambdacg-resolver-${uuid()}.zip`;

        await this.#s3Client
            .upload({
                Bucket: s3Bucket,
                Key: s3Key,
                Body: zipStream,
            })
            .promise();

        await this.#lambdaClient
            .updateFunctionCode({
                FunctionName: this.#lambdaName,
                S3Bucket: s3Bucket,
                S3Key: s3Key,
            })
            .promise();
    }
}

export { 
    LambdaUpdateTargetConfig,
    LambdaUpdateTarget
};
