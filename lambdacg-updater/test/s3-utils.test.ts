import { v4 as uuid } from "uuid";
import { S3Folder, S3Object } from "lambdacg-updater/s3-utils";
import { expect } from "chai";
import { AwsTestSession } from "./lib/aws-test-session";
import { expectToThrowAsync } from "./lib/expect-to-throw";

let debugTestCallback: ((message: string) => void) | undefined = undefined;

const debugTest: (message: string) => void = (message) => {
    if (debugTestCallback) {
        debugTestCallback(message);
    }
};

describe("S3Utils", async function () {
    debugTestCallback = undefined;
    const awsTestSession = new AwsTestSession(
        debugTest,
        "eu-west-1",
        "lambdacgtest-"
    );

    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and long slowness theshold
    this.timeout("15s");
    this.slow("10s");

    before(async () => {
        await awsTestSession.initializeAsync();
    });

    after(async () => await awsTestSession.cleanupAsync());

    describe("S3Folder", function () {
        const packageFileNames = [
            "tgz.file.tgz",
            "tar.gz.file.tar.gz",
            "tar.file.tar",
        ];
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

        let s3Bucket: string | undefined = undefined;

        before(async function () {
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

        describe("constructor", function () {
            it(
                "Should throw when constructed for URL s3://[s3Bucket]/prefix",
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
        });

        describe("listLatestObjectVersionsAsync", function () {
            it(
                "Should list package tarballs in s3://[s3Bucket]/prefix/",
                awsTestSession.withAws(async function () {
                    const s3Folder = S3Folder.fromUrl(
                        `s3://${s3Bucket}/prefix/`,
                        awsTestSession.s3Client,
                        10
                    );

                    const result = await s3Folder.listLatestObjectVersionsAsync(
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
                    const result = await s3Folder.listLatestObjectVersionsAsync(
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
                    const result = await s3Folder.listLatestObjectVersionsAsync(
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
});
