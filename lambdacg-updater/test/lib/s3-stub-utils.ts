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

class S3ClientStub {
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
                } as Request<S3.ListObjectVersionsOutput, AWSError>);
            counter++;
        }
    };

    setupGetObjectTagging(tags: { [key: string]: string }) {
        this.#stub.getObjectTagging.returns({
            promise: () =>
                Promise.resolve({
                    TagSet: Object.keys(tags).map((k) => ({
                        Key: k,
                        Value: tags[k],
                    })) as S3.TagSet,
                }),
        } as Request<S3.GetObjectTaggingOutput, AWSError>);
    }

    setupPutObjectTagging() {
        this.#stub.putObjectTagging.returns({
            promise: () => Promise.resolve({}),
        } as Request<S3.PutObjectTaggingOutput, AWSError>);
    }

    setupGetObject(createReadStreamContents: string) {
        this.#stub.getObject.returns({
            createReadStream: () => {
                const result = new Readable();
                result.push(createReadStreamContents);
                result.push(null);
                return result;
            },
        } as Request<S3.GetObjectOutput, AWSError>);
    }
}

export { S3ClientStub };
