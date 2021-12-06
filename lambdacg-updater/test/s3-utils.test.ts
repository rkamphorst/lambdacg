import { stringify, v4 as uuid } from "uuid";
import { getS3TarballNamesAsync } from "lambdacg-updater/s3-utils";
import { expect } from "chai";
import { AwsTestSession } from './aws-test-session'

describe("S3Utils", async () => {

    const awsTestSession = new AwsTestSession(msg => console.log(msg), 'eu-west-1', 'lambdacgtest-');

    before(() => awsTestSession.initializeAsync());

    after(() => awsTestSession.cleanupAsync());


    describe("getS3TarballUrlsAsync", () => {
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

        let s3Bucket:(string|undefined) = undefined;

        before(async () => {
            if (awsTestSession.hasAwsCredentials()) {
                const s3Contents:{[key:string]:string} =
                    Object.assign({}, ...fileNames.map((fn) => ({[fn]: fn})));
                s3Bucket = await awsTestSession.createS3BucketWithContentsAsync(s3Contents);
            }
        });

        it(
            "Should list package tarballs in s3://[s3Bucket]/prefix/",
            awsTestSession.withAws(async () => {
                const result = await getS3TarballNamesAsync(
                    `s3://${s3Bucket}/prefix/`
                );
                expect(result).to.have.deep.members(packageFileNamesWithPrefix);
            })
        );

        it(
            "Should list package tarballs in s3://[s3Bucket]/prefix",
            awsTestSession.withAws(async () => {
                const result = await getS3TarballNamesAsync(
                    `s3://${s3Bucket}/prefix`
                );
                expect(result).to.have.deep.members(packageFileNamesWithPrefix);
            })
        );

        it(
            "Should list package tarballs in s3://[s3Bucket]/",
            awsTestSession.withAws(async () => {
                const result = await getS3TarballNamesAsync(
                    `s3://${s3Bucket}/`
                );
                expect(result).to.have.deep.members(packageFileNames);
            })
        );

        it(
            "Should list package tarballs in s3://[s3Bucket]",
            awsTestSession.withAws(async () => {
                const result = await getS3TarballNamesAsync(`s3://${s3Bucket}`);
                expect(result).to.have.deep.members(packageFileNames);
            })
        );
    });

});
