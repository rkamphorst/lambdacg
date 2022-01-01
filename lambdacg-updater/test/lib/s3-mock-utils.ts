import { AWSError, Request, S3 } from "aws-sdk";
import { Readable } from "node:stream";
import sinon, { SinonStubbedInstance } from "sinon";

type VersionSpec =
    | string
    | {
          Key: string;
          VersionId?: string | undefined;
          LastModified?: Date | undefined;
          IsLatest?: boolean | undefined;
          IsDeleted?: boolean | undefined;
      };

type VersionMatch =
    | string
    | {
          Key?: string;
          VersionId?: string | undefined;
      }
    | ((v: { Key: string; VersionId?: string | undefined }) => boolean);

const isMatch = (
    vm: VersionMatch,
    v: { Key: string; VersionId?: string | undefined }
) => {
    if (typeof vm === "string") {
        return v.Key === vm;
    } else if (typeof vm === "object") {
        return (
            (!("Key" in vm) || vm.Key === v.Key) &&
            (!("VersionId" in vm) || vm.VersionId === v.VersionId)
        );
    } else {
        return vm(v);
    }
};

const specToVersion = (item: {
    Key: string;
    VersionId?: string | undefined;
    LastModified?: Date | undefined;
    IsLatest?: boolean | undefined;
}) => {
    return {
        Key: item.Key,
        VersionId: item.VersionId ?? "null",
        LastModified: item.LastModified ?? new Date("1990-01-01T13:30:15Z"),
        IsLatest: item.IsLatest ?? true,
    };
};

class S3ClientMock {
    #stub: SinonStubbedInstance<S3>;

    constructor() {
        this.#stub = sinon.createStubInstance(S3);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        this.#stub.listObjectVersions = sinon.stub() as any;
        this.#stub.getObjectTagging = sinon.stub() as any;
        this.#stub.getObject = sinon.stub() as any;
        this.#stub.putObjectTagging = sinon.stub() as any;
        /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    get object(): SinonStubbedInstance<S3> {
        return this.#stub;
    }

    setupListObjectVersions = (
        prefix: string | undefined,
        ...lists: VersionSpec[][]
    ) => {
        let counter = 0;

        const spies = [];

        for (const list of lists) {
            const keyMarker =
                counter == 0 ? undefined : `keyMarker-${counter - 1}`;
            const versionIdMarker =
                counter == 0 ? undefined : `versionIdMarker-${counter - 1}`;

            const isTruncated = counter < lists.length - 1;
            const nextKeyMarker = isTruncated
                ? `keyMarker-${counter}`
                : undefined;
            const nextVersionIdMarker = isTruncated
                ? `versionIdMarker-${counter}`
                : undefined;
            const olist = list.map((i) =>
                typeof i === "string" ? { Key: i } : i
            );
            const versions = olist
                .filter((i) => i.IsDeleted !== true)
                .map(specToVersion);
            const deleteMarkers = olist
                .filter((i) => i.IsDeleted === true)
                .map(specToVersion);

            spies.push(
                this.#stub.listObjectVersions
                    .withArgs(
                        sinon.match(
                            (r: S3.ListObjectVersionsRequest) =>
                                r.Prefix === prefix &&
                                r.KeyMarker === keyMarker &&
                                r.VersionIdMarker === versionIdMarker
                        )
                    )
                    .returns({
                        promise: () => {
                            return Promise.resolve({
                                IsTruncated: isTruncated,
                                NextKeyMarker: nextKeyMarker,
                                NextVersionIdMarker: nextVersionIdMarker,
                                Versions:
                                    versions.length == 0
                                        ? undefined
                                        : (versions as S3.ObjectVersionList),
                                DeleteMarkers:
                                    deleteMarkers.length == 0
                                        ? undefined
                                        : (deleteMarkers as S3.DeleteMarkers),
                            });
                        },
                    } as Request<S3.ListObjectVersionsOutput, AWSError>)
            );
            counter++;
        }
        return spies;
    };

    setupGetObjectTagging(
        version: VersionMatch,
        tags: { [key: string]: string }
    ) {
        let spy: sinon.SinonStub = this.#stub.getObjectTagging;

        if (version) {
            spy = spy.withArgs(
                sinon.match((arg: S3.GetObjectTaggingRequest) => {
                    return isMatch(version, arg);
                })
            );
        }

        spy = spy.returns({
            promise: () =>
                Promise.resolve({
                    TagSet: Object.keys(tags).map((k) => ({
                        Key: k,
                        Value: tags[k],
                    })) as S3.TagSet,
                }),
        } as Request<S3.GetObjectTaggingOutput, AWSError>);

        return spy;
    }

    setupPutObjectTagging(
        version: VersionMatch,
        tags?: { [key: string]: string | undefined }
    ) {
        return this.#stub.putObjectTagging
            .withArgs(
                sinon.match((arg: S3.PutObjectTaggingRequest) => {
                    if (version) {
                        if (!isMatch(version, arg)) {
                            return false;
                        }
                    }
                    if (tags) {
                        const argTags: { [key: string]: string } = {};
                        arg.Tagging.TagSet.forEach(
                            (t) => (argTags[t.Key] = t.Value)
                        );

                        for (const key of Object.keys(tags)) {
                            if (tags[key] !== argTags[key]) {
                                return false;
                            }
                        }
                    }
                    return true;
                })
            )
            .returns({
                promise: () => Promise.resolve({}),
            } as Request<S3.PutObjectTaggingOutput, AWSError>);
    }

    setupGetObject(version: VersionMatch, createReadStreamContents: string) {
        return this.#stub.getObject
            .withArgs(
                sinon.match((arg: S3.GetObjectRequest) => isMatch(version, arg))
            )
            .returns({
                createReadStream: () => {
                    const result = new Readable();
                    result.push(createReadStreamContents);
                    result.push(null);
                    return result;
                },
            } as Request<S3.GetObjectOutput, AWSError>);
    }
}

export { S3ClientMock };
