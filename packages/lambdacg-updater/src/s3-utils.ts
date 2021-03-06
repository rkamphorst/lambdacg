type BucketPrefix = { Bucket: string; Prefix: string | undefined };
type BucketKey = { Bucket: string; Key: string };

const getBucketAndPrefixOrKeyFromS3Url = (
    s3Url: string
): { Bucket: string; PrefixOrKey: string | undefined } => {
    const s3Regex = /^(S3|s3):\/\/(?<bucket>[^/]+)(\/(?<prefixOrKey>.*))?$/;

    const reResult = s3Regex.exec(s3Url);

    if (!reResult) {
        throw new Error(`This is not a s3 URL: ${s3Url}`);
    }

    const groups = reResult.groups as {
        bucket: string;
        prefixOrKey: string | undefined;
    };

    const bucket = groups.bucket;
    const prefixOrKey =
        groups.prefixOrKey?.length === 0 ? undefined : groups.prefixOrKey;

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
): { Bucket: string; Key: string } => {
    const result = getBucketAndPrefixOrKeyFromS3Url(s3Folder);
    if (!result.PrefixOrKey || result.PrefixOrKey.endsWith("/")) {
        throw new Error(
            "The s3 URL does not indicate an object (it is empty or it ends in '/')"
        );
    }
    return {
        Bucket: result.Bucket,
        Key: result.PrefixOrKey as string,
    };
};

export {
    BucketKey,
    BucketPrefix,
    getBucketAndKeyFromS3ObjectUrl,
    getBucketAndPrefixFromS3FolderUrl,
};
