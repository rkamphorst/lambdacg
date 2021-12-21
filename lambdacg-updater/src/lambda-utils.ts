import { Lambda, S3 } from "aws-sdk";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

import { getBucketAndPrefixFromS3FolderUrl } from "./s3-utils";

const updateLambdaFunctionWithZipStreamAsync = async (
    zipStream: Readable,
    lambdaName: string,
    s3FolderUrl: string
) => {
    const { Bucket: s3Bucket, Prefix: s3Prefix } =
        await getBucketAndPrefixFromS3FolderUrl(s3FolderUrl);
    const s3Key = `${s3Prefix}lambdacg-resolver-${uuid()}.zip`;

    const s3Client = new S3();
    await s3Client
        .upload({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: zipStream,
        })
        .promise();

    const lambdaClient = new Lambda();
    await lambdaClient
        .updateFunctionCode({
            FunctionName: lambdaName,
            S3Bucket: s3Bucket,
            S3Key: s3Key,
        })
        .promise();
};

export { updateLambdaFunctionWithZipStreamAsync };
