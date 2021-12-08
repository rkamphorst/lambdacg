import { config as awsConfig, Lambda, S3 } from "aws-sdk";
import archiver from "archiver";
import { v4 as uuid } from "uuid";

const updateLambdaFunctionWithDirectoryAsync = async (
    codeDirectory: string,
    lambdaName: string,
    s3Uri: string
) => {
    awsConfig.update({ region: "eu-west-1" });

    const archive = archiver("zip");
    archive.directory(codeDirectory, false);
    archive.finalize();

    const { hostname: s3Bucket, pathname: pathname } = new URL(s3Uri);
    const s3Prefix = pathname.substr(1);
    const s3Key = `${
        s3Prefix.length > 0 ? s3Prefix + "/" : ""
    }lambdacg-resolver-${uuid()}.zip`;

    const s3Client = new S3();
    await s3Client
        .upload({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: archive,
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

export { updateLambdaFunctionWithDirectoryAsync };
