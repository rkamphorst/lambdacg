import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { Readable } from "node:stream";

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

class S3Folder {
    static fromUrl(
        s3FolderUrl: string,
        s3Client?: S3,
        maxKeysPerInvocation?: number
    ): S3Folder {
        const bucketAndPrefix = getBucketAndPrefixFromS3FolderUrl(s3FolderUrl);
        return new S3Folder(
            bucketAndPrefix,
            s3Client ?? new S3(),
            maxKeysPerInvocation ?? 1000
        );
    }

    #bucketAndPrefix: { Bucket: string; Prefix: string | undefined };
    #maxKeysPerInvocation: number;
    #s3Client: S3;

    constructor(
        bucketAndPrefix: { Bucket: string; Prefix: string | undefined },
        s3Client: S3,
        maxKeysPerInvocation: number
    ) {
        this.#bucketAndPrefix = bucketAndPrefix;
        this.#maxKeysPerInvocation = maxKeysPerInvocation;
        this.#s3Client = s3Client;
    }

    async listLatestObjectVersionsAsync(nameRe: RegExp): Promise<S3Object[]> {
        const result: S3Object[] = [];
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
                    ...this.#bucketAndPrefix,
                    ...continuationToken,
                    MaxKeys: this.#maxKeysPerInvocation,
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
                                this.#bucketAndPrefix.Prefix?.length ?? 0
                            );

                            return (
                                filename &&
                                filename.length > 0 &&
                                filename.indexOf("/") < 0 &&
                                nameRe.test(filename)
                            );
                        })
                        .map(
                            (v) =>
                                new S3Object(
                                    {
                                        Bucket: this.#bucketAndPrefix.Bucket,
                                        Key: v.Key as string,
                                        VersionId: v.VersionId as string,
                                    },
                                    this.#s3Client
                                )
                        )
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
    }
}

class S3Object {
    static fromUrlAndVersion(
        s3ObjectUrl: string,
        version: string,
        s3Client?: S3
    ): S3Object {
        const bucketKeyVersion = {
            ...getBucketAndKeyFromS3ObjectUrl(s3ObjectUrl),
            VersionId: version,
        };
        return new S3Object(bucketKeyVersion, s3Client ?? new S3());
    }

    #bucketKeyVersion: { Bucket: string; Key: string; VersionId: string };
    #s3Client: S3;

    get key(): string {
        return this.#bucketKeyVersion.Key;
    }

    get name(): string {
        return this.#bucketKeyVersion.Key.substring(
            this.#bucketKeyVersion.Key.lastIndexOf("/") + 1
        );
    }

    get version(): string {
        return this.#bucketKeyVersion.VersionId;
    }

    constructor(
        bucketKeyVersion: { Bucket: string; Key: string; VersionId: string },
        s3Client: S3
    ) {
        this.#bucketKeyVersion = bucketKeyVersion;
        this.#s3Client = s3Client;
    }

    async getTagsAsync(): Promise<{ key: string; value: string }[]> {
        const tags = await this.#s3Client
            .getObjectTagging({
                ...this.#bucketKeyVersion,
            })
            .promise();

        return tags.TagSet.map((t) => ({ key: t.Key, value: t.Value }));
    }

    async setTagsAsync(tags: { key: string; value: string }[]): Promise<void> {
        await this.#s3Client
            .putObjectTagging({
                ...this.#bucketKeyVersion,
                Tagging: {
                    TagSet: tags.map((t) => ({ Key: t.key, Value: t.value })),
                },
            })
            .promise();
    }

    getDownloadStream(): Readable {
        return this.#s3Client
            .getObject({ ...this.#bucketKeyVersion })
            .createReadStream();
    }
}

export {
    S3Folder,
    S3Object,
    getBucketAndPrefixFromS3FolderUrl,
    getBucketAndKeyFromS3ObjectUrl,
};
