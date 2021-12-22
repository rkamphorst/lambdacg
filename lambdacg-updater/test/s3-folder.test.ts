import { expect } from "chai";
import { S3Folder, S3Object } from "lambdacg-updater/s3-folder";
import { v4 as uuid } from "uuid";

import { AwsTestSession } from "./lib/aws-test-session";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeClass, describeMember } from "./lib/mocha-utils";

let debugTestCallback: ((message: string) => void) | undefined = undefined;

const debugTest: (message: string) => void = (message) => {
    if (debugTestCallback) {
        debugTestCallback(message);
    }
};

const packageFileNames = ["tgz.file.tgz", "tar.gz.file.tar.gz", "tar.file.tar"];
const packageFileNamesWithPrefix = [
    "prefix/tgz.file.tgz",
    "prefix/tar.gz.file.tar.gz",
    "prefix/tar.file.tar",
];
const nonPackageFileNames = [...Array(73).keys()].map(() => uuid());
const nonPackageFileNamesWithPrefix = [...Array(79).keys()].map(
    () => `prefix/${uuid()}`
);
const fileNames = [
    ...packageFileNamesWithPrefix,
    ...nonPackageFileNames,
    ...packageFileNames,
    ...nonPackageFileNamesWithPrefix,
];

describe("S3Folder", async function () {
    debugTestCallback = undefined;
    const awsTestSession = new AwsTestSession(debugTest, "eu-west-1");

    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and long slowness threshold
    this.timeout("15s");
    this.slow("10s");

    // S3 bucket to be used throughout the test
    let s3Bucket: string | undefined = undefined;

    before(async function () {
        await awsTestSession.initializeAsync();

        if (awsTestSession.hasAwsCredentials()) {
            const s3Contents: { [key: string]: string } = Object.assign(
                {},
                ...fileNames.map((fn) => ({ [fn]: fn }))
            );
            s3Bucket = await awsTestSession.createS3BucketWithContentsAsync(
                s3Contents
            );
        }
    });

    after(async () => await awsTestSession.cleanupAsync());

    describeClass({ S3Folder }, function () {
        describe("fromUrl", function () {
            it(
                "Should throw for URL s3://[s3Bucket]/prefix",
                awsTestSession.withAws(async function () {
                    await expectToThrowAsync(() =>
                        S3Folder.fromUrl(
                            `s3://${s3Bucket}/prefix`,
                            awsTestSession.s3Client,
                            10
                        )
                    );
                })
            );
            it(
                "Should be successful for URL s3://[s3Bucket]/prefix/",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}/prefix/`,
                        awsTestSession.s3Client,
                        10
                    );
                    expect(s3Folder).to.not.be.null;
                    expect(s3Folder).to.be.instanceOf(S3Folder);
                })
            );
        });

        describeMember<S3Folder>("listLatestItemVersionsAsync", function () {
            it(
                "Should list package tarballs in s3://[s3Bucket]/prefix/",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}/prefix/`,
                        awsTestSession.s3Client,
                        10
                    );

                    const result = await s3Folder.listLatestItemVersionsAsync(
                        /(\.tgz|\.tar.gz|\.tar)$/
                    );

                    expect(result).to.not.be.null;
                    expect(result.length).to.be.equal(
                        packageFileNamesWithPrefix.length
                    );
                    result.forEach((o) => expect(o).to.be.instanceOf(S3Object));
                    expect(result.map((o) => o.name)).to.have.deep.members(
                        packageFileNames
                    );
                    expect(result.map((o) => o.key)).to.have.deep.members(
                        packageFileNamesWithPrefix
                    );
                })
            );

            it(
                "Should list package tarballs in s3://[s3Bucket]/",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}/`,
                        awsTestSession.s3Client,
                        10
                    );
                    const result = await s3Folder.listLatestItemVersionsAsync(
                        /(\.tgz|\.tar.gz|\.tar)$/
                    );

                    expect(result).to.not.be.null;
                    expect(result.length).to.be.equal(
                        packageFileNamesWithPrefix.length
                    );
                    result.forEach((o) => expect(o).to.be.instanceOf(S3Object));
                    expect(result.map((o) => o.name)).to.have.deep.members(
                        packageFileNames
                    );
                    expect(result.map((o) => o.key)).to.have.deep.members(
                        packageFileNames
                    );
                })
            );

            it(
                "Should list package tarballs in s3://[s3Bucket]",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}`,
                        awsTestSession.s3Client,
                        10
                    );
                    const result = await s3Folder.listLatestItemVersionsAsync(
                        /(\.tgz|\.tar.gz|\.tar)$/
                    );
                    expect(result).to.not.be.null;
                    expect(result.length).to.be.equal(
                        packageFileNamesWithPrefix.length
                    );
                    result.forEach((o) => expect(o).to.be.instanceOf(S3Object));
                    expect(result.map((o) => o.name)).to.have.deep.members(
                        packageFileNames
                    );
                    expect(result.map((o) => o.key)).to.have.deep.members(
                        packageFileNames
                    );
                })
            );
        });
    });

    describeClass({ S3Object }, function () {
        describe("fromUrlAndVersion", function () {
            it(
                "Should throw for URL s3://[s3Bucket]/object/key/",
                awsTestSession.withAws(async function () {
                    await expectToThrowAsync(() =>
                        S3Object.fromUrlAndVersion(
                            `s3://${s3Bucket}/object/key/`,
                            "null",
                            awsTestSession.s3Client
                        )
                    );
                })
            );
            it(
                "Should be successful for URL s3://[s3Bucket]/object/key",
                awsTestSession.withAws(async function () {
                    const s3Object = S3Object.fromUrlAndVersion(
                        `s3://${s3Bucket}/object/key`,
                        "null",
                        awsTestSession.s3Client
                    );
                    expect(s3Object).to.not.be.null;
                    expect(s3Object).to.be.instanceOf(S3Object);
                })
            );
        });

        describeMember<S3Object>("setTagsAsync", function () {
            it(
                "Should get the same tags as the ones set",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}`,
                        awsTestSession.s3Client,
                        1000
                    );
                    const s3Object = (
                        await s3Folder.listLatestItemVersionsAsync(/.*/)
                    )[0];

                    await s3Object.setTagsAsync([
                        { key: "a", value: "a-value" },
                        { key: "b", value: "b-value" },
                    ]);

                    const gotTags = await s3Object.getTagsAsync();

                    expect(gotTags).to.have.deep.members([
                        { key: "a", value: "a-value" },
                        { key: "b", value: "b-value" },
                    ]);
                })
            );

            it(
                "Should set tags on the specific version",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}`,
                        awsTestSession.s3Client,
                        1000
                    );
                    const s3ObjectV1 = (
                        await s3Folder.listLatestItemVersionsAsync(/.*/)
                    )[0];
                    await s3ObjectV1.setTagsAsync([]);
                    const gotTags = await s3ObjectV1.getTagsAsync();
                    expect(gotTags).to.be.empty;

                    // upload a new version of s3Object
                    await awsTestSession.uploadS3ObjectAsync(
                        s3Bucket as string,
                        s3ObjectV1.key,
                        "new content"
                    );

                    // get the latest version of the object
                    const s3ObjectV2 = (
                        await s3Folder.listLatestItemVersionsAsync(/.*/)
                    ).filter((o) => o.key == s3ObjectV1.key)[0];

                    // this should be a new version
                    expect(s3ObjectV2.version).to.not.be.equal(
                        s3ObjectV1.version
                    );

                    // now, set the tags on the latest version
                    await s3ObjectV2.setTagsAsync([
                        { key: "x", value: "x-value" },
                        { key: "z", value: "z-value" },
                    ]);

                    const gotTagsV1 = await s3ObjectV1.getTagsAsync();
                    const gotTagsV2 = await s3ObjectV2.getTagsAsync();

                    // v1 should still have no tags, while v2 shoult have them
                    expect(gotTagsV1).to.be.empty;
                    expect(gotTagsV2).to.have.deep.members([
                        { key: "x", value: "x-value" },
                        { key: "z", value: "z-value" },
                    ]);
                })
            );

            it(
                "Should set tags on a delete marker",
                awsTestSession.withAws(async function () {
                    // skip this test, delete markers cannot be tagged unfortunately
                    this.skip();

                    await awsTestSession.uploadS3ObjectAsync(
                        s3Bucket as string,
                        "object-to-be-deleted",
                        "new content"
                    );
                    await awsTestSession.deleteS3ObjectAsync(
                        s3Bucket as string,
                        "object-to-be-deleted"
                    );

                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}`,
                        awsTestSession.s3Client,
                        1000
                    );

                    const s3Object = (
                        await s3Folder.listLatestItemVersionsAsync(
                            /^object-to-be-deleted$/
                        )
                    )[0];

                    expect(s3Object).to.not.be.undefined;
                    expect(s3Object.isDeleted).to.be.true;

                    await s3Object.setTagsAsync([
                        { key: "a", value: "a-value" },
                        { key: "b", value: "b-value" },
                    ]);

                    const gotTags = await s3Object.getTagsAsync();

                    expect(gotTags).to.have.deep.members([
                        { key: "a", value: "a-value" },
                        { key: "b", value: "b-value" },
                    ]);
                })
            );

            it(
                "Should fail if more than 10 tags set",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}`,
                        awsTestSession.s3Client,
                        1000
                    );
                    const s3Object = (
                        await s3Folder.listLatestItemVersionsAsync(/.*/)
                    )[0];

                    expectToThrowAsync(
                        async () =>
                            await s3Object.setTagsAsync([
                                { key: "0", value: "a-value" },
                                { key: "1", value: "b-value" },
                                { key: "2", value: "c-value" },
                                { key: "3", value: "d-value" },
                                { key: "4", value: "e-value" },
                                { key: "5", value: "f-value" },
                                { key: "6", value: "g-value" },
                                { key: "7", value: "h-value" },
                                { key: "8", value: "i-value" },
                                { key: "9", value: "j-value" },
                                { key: "10", value: "k-value" },
                            ])
                    );
                })
            );
        });

        describeMember<S3Object>("getDownloadStream", function () {
            it(
                "Should correctly download the contents of an object",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}/prefix/`,
                        awsTestSession.s3Client,
                        1000
                    );
                    const s3Object = (
                        await s3Folder.listLatestItemVersionsAsync(/.*/)
                    ).filter((x) => x.key == "prefix/tar.gz.file.tar.gz")[0];

                    const stream = s3Object.getDownloadStream();

                    const buffers: Buffer[] = [];

                    const promise = new Promise((resolve, reject) => {
                        stream.on("data", (data) => {
                            buffers.push(data);
                        });

                        stream.on("end", (err: unknown) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(
                                    Buffer.concat(buffers).toString("utf-8")
                                );
                            }
                        });
                    });

                    stream.resume();
                    const result = await promise;

                    expect(result).to.be.equal("prefix/tar.gz.file.tar.gz");
                })
            );
        });
    });
});
