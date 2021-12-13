import { v4 as uuid } from "uuid";
import { getS3NamesAndVersionsAsync } from "lambdacg-updater/s3-utils";
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

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync());

    describe("getS3NamesAndVersionsAsync", function () {
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

        it(
            "Should list package tarballs in s3://[s3Bucket]/prefix/",
            awsTestSession.withAws(async function () {
                const result = await getS3NamesAndVersionsAsync(
                    `s3://${s3Bucket}/prefix/`,
                    /(\.tgz|\.tar.gz|\.tar)$/
                );
                expect(result).to.have.deep.members(
                    packageFileNamesWithPrefix.map((name) => ({
                        name,
                        version: "null",
                    }))
                );
            })
        );

        it(
            "Should throw when listing tarballs in s3://[s3Bucket]/prefix",
            awsTestSession.withAws(async function () {
                await expectToThrowAsync(() =>
                    getS3NamesAndVersionsAsync(
                        `s3://${s3Bucket}/prefix`,
                        /(\.tgz|\.tar.gz|\.tar)$/
                    )
                );
            })
        );

        it(
            "Should list package tarballs in s3://[s3Bucket]/",
            awsTestSession.withAws(async function () {
                const result = await getS3NamesAndVersionsAsync(
                    `s3://${s3Bucket}/`,
                    /(\.tgz|\.tar.gz|\.tar)$/
                );
                expect(result).to.have.deep.members(
                    packageFileNames.map((name) => ({ name, version: "null" }))
                );
            })
        );

        it(
            "Should list package tarballs in s3://[s3Bucket]",
            awsTestSession.withAws(async function () {
                const result = await getS3NamesAndVersionsAsync(
                    `s3://${s3Bucket}`,
                    /(\.tgz|\.tar.gz|\.tar)$/
                );
                expect(result).to.have.deep.members(
                    packageFileNames.map((name) => ({ name, version: "null" }))
                );
            })
        );
    });
});
