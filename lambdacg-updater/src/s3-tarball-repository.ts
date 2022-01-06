import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { Readable } from "node:stream";

import {
    BucketKey,
    BucketPrefix,
    getBucketAndPrefixFromS3FolderUrl,
} from "./s3-utils";
import {
    RepositoryTarballInterface,
    TarballRepositoryInterface,
} from "./updater-contract";

const ObjectChange: unique symbol = Symbol("lambdacg-update");
const ObjectDeletion: unique symbol = Symbol("lambdacg-deletion");

type BucketKeyVersion = BucketKey & { VersionId: string };

type UpdateType = typeof ObjectChange | typeof ObjectDeletion;
type UpdateMark = {
    Update: UpdateType;
    Mark: string;
};

const getVersionIdAndLastModifiedOrThrow = (
    version: S3.DeleteMarkerEntry | S3.ObjectVersion
) => {
    if (!version.VersionId) {
        throw new Error("Version ID not given");
    }
    if (!version.LastModified) {
        throw new Error("Last Modified (timestamp) not given");
    }
    return {
        VersionId: version.VersionId,
        LastModified: version.LastModified,
    };
};

class S3TarballRepository implements TarballRepositoryInterface {
    static fromUrl(
        s3FolderUrl: string,
        s3Client: S3,
        maxKeysPerInvocation = 1000
    ): S3TarballRepository {
        const bucketAndPrefix = getBucketAndPrefixFromS3FolderUrl(s3FolderUrl);
        return new S3TarballRepository(
            bucketAndPrefix,
            s3Client,
            maxKeysPerInvocation
        );
    }

    #bucketAndPrefix: BucketPrefix;
    #maxKeysPerInvocation: number;
    #s3Client: S3;
    #s3Objects: { [key: string]: S3RepositoryTarball };
    #initializePromise: Promise<void> | undefined;
    #isInitialized: boolean;
    #updateMark: string | undefined;

    constructor(
        bucketAndPrefix: BucketPrefix,
        s3Client: S3,
        maxKeysPerInvocation: number
    ) {
        this.#bucketAndPrefix = bucketAndPrefix;
        this.#maxKeysPerInvocation = maxKeysPerInvocation;
        this.#s3Client = s3Client;
        this.#s3Objects = {};
        this.#initializePromise = undefined;
        this.#isInitialized = false;
    }

    initializeAsync(): Promise<void> {
        const internalInitializeAsync = async () => {
            await this.#foreachTgzVersionAsync(
                (v) =>
                    this.#getOrCreateS3HandlerTarball(
                        v.Key as string
                    ).addVersion(v),
                (d) =>
                    this.#getOrCreateS3HandlerTarball(
                        d.Key as string
                    ).addDeleteMarker(d)
            );

            // remove s3 objects that do not have complete version info
            for (const s3Obj of Object.values(this.#s3Objects)) {
                if (!s3Obj.hasCompleteVersionInfo()) {
                    delete this.#s3Objects[s3Obj.url];
                }
            }

            this.#isInitialized = true;
            this.#updateMark = await this.#getUpdateMarkAsync();
        };
        if (this.#initializePromise === undefined) {
            this.#initializePromise = internalInitializeAsync();
        }
        return this.#initializePromise;
    }

    #getOrCreateS3HandlerTarball(key: string): S3RepositoryTarball {
        const s3Obj = new S3RepositoryTarball(
            { Bucket: this.#bucketAndPrefix.Bucket, Key: key },
            this.#s3Client
        );

        if (s3Obj.url in this.#s3Objects) {
            return this.#s3Objects[s3Obj.url];
        }
        this.#s3Objects[s3Obj.url] = s3Obj;
        return s3Obj;
    }

    async #foreachTgzVersionAsync(
        objectVersionCallback: (v: S3.ObjectVersion) => void,
        deleteMarkerCallback: (v: S3.DeleteMarkerEntry) => void
    ) {
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

            listVersionsResult.Versions?.filter((v) =>
                this.#selectTgz(v)
            ).forEach(objectVersionCallback);
            listVersionsResult.DeleteMarkers?.filter((d) =>
                this.#selectTgz(d)
            ).forEach(deleteMarkerCallback);

            if (listVersionsResult.IsTruncated) {
                continuationToken = {
                    KeyMarker: listVersionsResult.NextKeyMarker,
                    VersionIdMarker: listVersionsResult.NextVersionIdMarker,
                };
            } else {
                continuationToken = undefined;
            }
        } while (continuationToken);
    }

    #selectTgz(obj: S3.ObjectVersion | S3.DeleteMarkerEntry): boolean {
        const filename = (obj.Key as string).substring(
            this.#bucketAndPrefix.Prefix?.length ?? 0
        );

        return (
            !!filename &&
            filename.length > 0 &&
            filename.indexOf("/") < 0 &&
            /(\.tgz|\.tar\.gz)$/.test(filename)
        );
    }

    async #getUpdateMarkAsync(): Promise<string | undefined> {
        const marks = await Promise.all(
            Object.values(this.#s3Objects).map((o) => o.getUpdateMarkAsync())
        );

        let result: string | undefined = undefined;
        for (const mark of marks) {
            if (mark === undefined) {
                // any undefined update mark on one of the objects
                // means this version has not been deployed yet,
                // and no update mark has been set on this version.
                return undefined;
            }
            if (result === undefined || result < mark) {
                result = mark;
            }
        }
        return result;
    }

    get isUpToDate(): boolean {
        this.#assertIsInitialized();
        return (
            this.#updateMark !== undefined ||
            Object.keys(this.#s3Objects).length == 0
        );
    }

    get updateMark(): string | undefined {
        this.#assertIsInitialized();
        return this.#updateMark;
    }

    get tarballs(): S3RepositoryTarball[] {
        this.#assertIsInitialized();
        return Object.values(this.#s3Objects).filter((o) => !o.isDeleted);
    }

    async markUpdatedAsync(): Promise<string> {
        this.#assertIsInitialized();
        if (this.#updateMark !== undefined) {
            throw new Error("Already up to date");
        }

        const updateMark = new Date().toISOString();

        await Promise.all(
            Object.values(this.#s3Objects).map(async (o) => {
                if ((await o.getUpdateMarkAsync()) === undefined) {
                    await o.markUpdatedAsync(updateMark);
                }
            })
        );

        this.#updateMark = updateMark;
        return updateMark;
    }

    #assertIsInitialized() {
        if (!this.#isInitialized) {
            throw new Error("You need to call initialize first");
        }
    }
}

class S3RepositoryTarball implements RepositoryTarballInterface {
    #s3Client: S3;
    #bucketAndKey: BucketKey;
    #latestVersion:
        | { VersionId: string; LastModified: Date; IsDeleteMarker: boolean }
        | undefined;
    #previousDeleteMarker:
        | { VersionId: string; LastModified: Date }
        | undefined;
    #previousObjectVersion:
        | { VersionId: string; LastModified: Date }
        | undefined;
    #updateMarkPromise: Promise<string | undefined> | undefined;

    constructor(bucketAndKey: BucketKey, s3Client: S3) {
        this.#s3Client = s3Client;
        this.#bucketAndKey = bucketAndKey;
        this.#latestVersion = undefined;
        this.#previousObjectVersion = undefined;
        this.#previousDeleteMarker = undefined;
    }

    get url(): string {
        return `s3://${this.#bucketAndKey.Bucket}/${this.#bucketAndKey.Key}`;
    }

    addVersion(objectVersion: S3.ObjectVersion) {
        const { VersionId: versionId, LastModified: lastModified } =
            getVersionIdAndLastModifiedOrThrow(objectVersion);
        if (objectVersion.IsLatest) {
            this.#setLatestVersion(versionId, lastModified, false);
        } else {
            this.#updatePreviousObjectVersion(versionId, lastModified);
        }
    }

    addDeleteMarker(deleteMarker: S3.DeleteMarkerEntry) {
        const { VersionId: versionId, LastModified: lastModified } =
            getVersionIdAndLastModifiedOrThrow(deleteMarker);
        if (deleteMarker.IsLatest) {
            this.#setLatestVersion(versionId, lastModified, true);
        } else {
            this.#updatePreviousDeleteMarker(versionId, lastModified);
        }
    }

    hasCompleteVersionInfo(errorCallback?: (message: string) => void): boolean {
        const emit = (message: string) => {
            if (errorCallback) {
                errorCallback(message);
            }
        };

        if (!this.#latestVersion) {
            emit("Latest version not set");
            return false;
        }

        if (this.#latestVersion.IsDeleteMarker) {
            if (!this.#previousObjectVersion) {
                emit("Latest is delete marker, but no previous version found");
                return false;
            }

            if (
                this.#previousDeleteMarker &&
                this.#previousDeleteMarker.LastModified >
                    this.#previousObjectVersion.LastModified
            ) {
                emit(
                    "Latest is delete marker, but previous is also delete marker"
                );
                return false;
            }
        }
        return true;
    }

    #setLatestVersion(
        versionId: string,
        lastModified: Date,
        isDeleteMarker: boolean
    ) {
        if (this.#latestVersion !== undefined) {
            throw new Error(
                `Latest object version already set for ${this.url}: ${
                    this.#latestVersion
                }`
            );
        }

        this.#latestVersion = {
            LastModified: lastModified,
            VersionId: versionId,
            IsDeleteMarker: isDeleteMarker,
        };
    }

    #updatePreviousObjectVersion(versionId: string, lastModified: Date) {
        if (
            this.#previousObjectVersion === undefined ||
            this.#previousObjectVersion.LastModified < lastModified
        ) {
            this.#previousObjectVersion = {
                LastModified: lastModified,
                VersionId: versionId,
            };
        }
    }

    #updatePreviousDeleteMarker(versionId: string, lastModified: Date) {
        if (
            this.#previousDeleteMarker === undefined ||
            this.#previousDeleteMarker.LastModified < lastModified
        ) {
            this.#previousDeleteMarker = {
                LastModified: lastModified,
                VersionId: versionId,
            };
        }
    }

    #getLatestObjectVersionOrThrow() {
        if (this.#latestVersion === undefined) {
            throw new Error("No latest version");
        }

        if (this.#latestVersion.IsDeleteMarker) {
            throw new Error("Latest version is a delete marker");
        }
        return this.#latestVersion;
    }

    #getPreviousObjectVersionOrThrow() {
        if (!this.#previousObjectVersion) {
            throw new Error("No previous version");
        }

        if (this.#isPreviousDeleted) {
            throw new Error("Previous version is a delete marker");
        }

        return this.#previousObjectVersion;
    }

    #getPreviousObjectVersionOrUndefined() {
        if (this.#isPreviousDeleted) {
            return undefined;
        }
        return this.#previousObjectVersion;
    }

    #getLatestObjectBucketKeyVersionOrThrow(): BucketKeyVersion {
        return {
            ...this.#bucketAndKey,
            VersionId: this.#getLatestObjectVersionOrThrow().VersionId,
        };
    }

    #getPreviousObjectBucketKeyVersionOrThrow(): BucketKeyVersion {
        return {
            ...this.#bucketAndKey,
            VersionId: this.#getPreviousObjectVersionOrThrow().VersionId,
        };
    }

    #getPreviousObjectBucketKeyVersionOrUndefined():
        | BucketKeyVersion
        | undefined {
        const versionId =
            this.#getPreviousObjectVersionOrUndefined()?.VersionId;
        if (versionId !== undefined) {
            return { ...this.#bucketAndKey, VersionId: versionId };
        }
        return undefined;
    }

    get isDeleted(): boolean {
        if (!this.#latestVersion) {
            throw new Error("No latest versino");
        }
        return this.#latestVersion.IsDeleteMarker;
    }

    get #isPreviousDeleted(): boolean | undefined {
        if (this.#previousDeleteMarker && this.#previousObjectVersion) {
            if (
                this.#previousDeleteMarker.LastModified >
                this.#previousObjectVersion.LastModified
            ) {
                return true;
            }
        }
        return false;
    }

    get name(): string {
        const key = this.#bucketAndKey.Key;
        return key.substring(key.lastIndexOf("/") + 1);
    }

    getUpdateMarkAsync(): Promise<string | undefined> {
        const internalGetUpdateMarkAsync = async () => {
            const params:
                | { Update: UpdateType; TagBucketKeyVersion: BucketKeyVersion }
                | undefined = this.isDeleted
                ? {
                      Update: ObjectDeletion,
                      TagBucketKeyVersion:
                          this.#getPreviousObjectBucketKeyVersionOrThrow(),
                  }
                : {
                      Update: ObjectChange,
                      TagBucketKeyVersion:
                          this.#getLatestObjectBucketKeyVersionOrThrow(),
                  };

            const tags = await this.#s3Client
                .getObjectTagging({
                    ...params.TagBucketKeyVersion,
                })
                .promise();

            return tags.TagSet.find((t) => t.Key === params.Update.description)
                ?.Value;
        };

        if (this.#updateMarkPromise === undefined) {
            this.#updateMarkPromise = internalGetUpdateMarkAsync();
        }
        return this.#updateMarkPromise;
    }

    async markUpdatedAsync(updateMark: string) {
        if (!this.isDeleted) {
            await Promise.all([
                this.#setUpdateMarkAsync(
                    this.#getLatestObjectBucketKeyVersionOrThrow(),
                    { Update: ObjectChange, Mark: updateMark }
                ),
                this.#clearUpdateMarkAsync(
                    this.#getPreviousObjectBucketKeyVersionOrUndefined()
                ),
            ]);
        } else {
            await this.#setUpdateMarkAsync(
                this.#getPreviousObjectBucketKeyVersionOrThrow(),
                { Update: ObjectDeletion, Mark: updateMark }
            );
        }
        this.#updateMarkPromise = Promise.resolve(updateMark);
    }

    #setUpdateMarkAsync(
        bucketKeyVersion: BucketKeyVersion,
        updateMark: UpdateMark
    ) {
        return this.#s3Client
            .putObjectTagging({
                ...bucketKeyVersion,
                Tagging: {
                    TagSet: [
                        {
                            Key: updateMark.Update.description as string,
                            Value: updateMark.Mark,
                        },
                    ],
                },
            })
            .promise();
    }

    async #clearUpdateMarkAsync(
        bucketKeyVersion: BucketKeyVersion | undefined
    ) {
        if (bucketKeyVersion === undefined) {
            return Promise.resolve();
        }
        return this.#s3Client
            .putObjectTagging({
                ...bucketKeyVersion,
                Tagging: {
                    TagSet: [],
                },
            })
            .promise();
    }

    getDownloadStream(): Readable {
        return this.#s3Client
            .getObject({ ...this.#getLatestObjectBucketKeyVersionOrThrow() })
            .createReadStream();
    }
}

export { S3RepositoryTarball, S3TarballRepository };
