import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { Readable } from "node:stream";

import {
    FolderInterface,
    FolderItemInterface,
} from "./handler-repository-contract";
import {
    getBucketAndKeyFromS3ObjectUrl,
    getBucketAndPrefixFromS3FolderUrl,
} from "./s3-utils";

class S3Folder implements FolderInterface {
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

    #selectKey(
        nameRe: RegExp,
        obj: S3.ObjectVersion | S3.DeleteMarkerEntry
    ): boolean {
        const filename = obj.Key?.substr(
            this.#bucketAndPrefix.Prefix?.length ?? 0
        );

        return (
            !!filename &&
            filename.length > 0 &&
            filename.indexOf("/") < 0 &&
            nameRe.test(filename)
        );
    }

    #selectLatestVersion(
        obj: S3.ObjectVersion | S3.DeleteMarkerEntry
    ): boolean {
        return obj.IsLatest ?? false;
    }

    #toS3Object(
        obj: S3.ObjectVersion | S3.DeleteMarkerEntry,
        isDeleteMarker: boolean
    ): S3Object {
        return new S3Object(
            {
                Bucket: this.#bucketAndPrefix.Bucket,
                Key: obj.Key as string,
                VersionId: obj.VersionId as string,
            },
            isDeleteMarker,
            this.#s3Client
        );
    }

    #filterLatestAndMapToS3Object(
        nameRe: RegExp,
        objs: S3.ObjectVersion[] | S3.DeleteMarkerEntry[] | undefined,
        isDeleteMarker: boolean
    ) {
        if (!objs) {
            return [];
        }
        return objs
            .filter((v) => this.#selectLatestVersion(v))
            .filter((v) => this.#selectKey(nameRe, v))
            .map((v) => this.#toS3Object(v, isDeleteMarker));
    }

    async listLatestItemVersionsAsync(nameRe: RegExp): Promise<S3Object[]> {
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

            result.push(
                ...this.#filterLatestAndMapToS3Object(
                    nameRe,
                    listVersionsResult.DeleteMarkers,
                    true
                ),
                ...this.#filterLatestAndMapToS3Object(
                    nameRe,
                    listVersionsResult.Versions,
                    false
                )
            );

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

class S3Object implements FolderItemInterface {
    static fromUrlAndVersion(
        s3ObjectUrl: string,
        version: string,
        s3Client?: S3
    ): S3Object {
        const bucketKeyVersion = {
            ...getBucketAndKeyFromS3ObjectUrl(s3ObjectUrl),
            VersionId: version,
        };
        return new S3Object(bucketKeyVersion, false, s3Client ?? new S3());
    }

    #bucketKeyVersion: { Bucket: string; Key: string; VersionId: string };
    #isDeleted: boolean;
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

    get isDeleted(): boolean {
        return this.#isDeleted;
    }

    constructor(
        bucketKeyVersion: { Bucket: string; Key: string; VersionId: string },
        isDeleted: boolean,
        s3Client: S3
    ) {
        this.#bucketKeyVersion = bucketKeyVersion;
        this.#isDeleted = isDeleted;
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
    getBucketAndKeyFromS3ObjectUrl,
    getBucketAndPrefixFromS3FolderUrl,
    S3Folder,
    S3Object,
};
