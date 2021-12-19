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

export { getBucketAndKeyFromS3ObjectUrl, getBucketAndPrefixFromS3FolderUrl };
