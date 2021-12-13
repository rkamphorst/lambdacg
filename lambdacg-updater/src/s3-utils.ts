import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";

const getBucketAndPrefixOrKeyFromS3Url = (
    s3Url: string
): { Bucket: string; PrefixOrKey: string | undefined } => {
    const s3Regex = /^(S3|s3):\/\/(?<bucket>[^/]+)(\/(?<prefixOrKey>.*))?$/;

    const reResult = s3Regex.exec(s3Url);

    if (!reResult?.groups) {
        throw new Error(`This is not a s3 URL: ${s3Url}`);
    }

    const bucket = reResult.groups.bucket;
    const prefixOrKey =
        reResult.groups.prefixOrKey?.length === 0
            ? undefined
            : reResult.groups.prefixOrKey;

    return {
        Bucket: bucket,
        PrefixOrKey: prefixOrKey,
    };
};

const getBucketAndPrefixFromS3FolderUrl = (
    s3Folder: string
): { Bucket: string; Prefix: string | undefined } => {
    const result = getBucketAndPrefixOrKeyFromS3Url(s3Folder);
    if (result.PrefixOrKey && !result.PrefixOrKey.endsWith("/")) {
        throw new Error(
            "The s3 URL does not indicate a folder (does not end in '/')"
        );
    }
    return {
        Bucket: result.Bucket,
        Prefix: result.PrefixOrKey,
    };
};

const getBucketAndKeyFromS3ObjectUrl = (
    s3Folder: string
): { Bucket: string; Key: string | undefined } => {
    const result = getBucketAndPrefixOrKeyFromS3Url(s3Folder);
    if (!result.PrefixOrKey || result.PrefixOrKey.endsWith("/")) {
        throw new Error(
            "The s3 URL does not indicate an object (it is empty or it ends in '/')"
        );
    }
    return {
        Bucket: result.Bucket,
        Key: result.PrefixOrKey,
    };
};

const getS3NamesAndVersionsAsync = async (
    s3FolderUrl: string,
    nameRe: RegExp
) => {
    const s3BucketAndPrefix = await getBucketAndPrefixFromS3FolderUrl(
        s3FolderUrl
    );

    const s3Client = new S3();
    const result: { name: string; version: string | undefined }[] = [];
    let continuationToken:
        | { KeyMarker: string | undefined; VersionIdMarker: string | undefined }
        | undefined = undefined;

    do {
        const listVersionsResult: PromiseResult<
            S3.ListObjectVersionsOutput,
            AWSError
        > = await s3Client
            .listObjectVersions({
                ...s3BucketAndPrefix,
                ...continuationToken,
                MaxKeys: 25,
            })
            .promise();

        const listResultContents = listVersionsResult.Versions?.filter(
            (v) => v.IsLatest
        );

        if (listResultContents) {
            result.push(
                ...listResultContents
                    .filter((v) => {
                        const filename = v.Key?.substr(
                            s3BucketAndPrefix.Prefix?.length ?? 0
                        );

                        return (
                            filename &&
                            filename.length > 0 &&
                            filename.indexOf("/") < 0 &&
                            nameRe.test(filename)
                        );
                    })
                    .map((v) => ({
                        name: v.Key as string,
                        version: v.VersionId,
                    }))
            );
        }

        if (listVersionsResult.IsTruncated) {
            continuationToken = {
                KeyMarker: listVersionsResult.NextKeyMarker,
                VersionIdMarker: listVersionsResult.NextVersionIdMarker,
            };
        } else {
            continuationToken = undefined;
        }
    } while (continuationToken);

    return result;
};

export {
    getS3NamesAndVersionsAsync,
    getBucketAndPrefixFromS3FolderUrl,
    getBucketAndKeyFromS3ObjectUrl,
};
