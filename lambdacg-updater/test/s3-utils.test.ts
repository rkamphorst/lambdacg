import { S3 } from "aws-sdk";
import { v4 as uuid } from "uuid";
import { getS3TarballNamesAsync } from "lambdacg-updater/s3-utils";
import { expect } from "chai";
import { Context } from "mocha";

describe("S3Utils", () => {
    const s3Bucket = `lambdacgtest-${uuid()}`;
    const s3Client: S3 = new S3();
    const hasAwsCredentials = !!s3Client.config.credentials;
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

    const if_awscreds = function (
        test: (this: Context) => void | Promise<void>
    ) {
        return function (this: Context) {
            if (!hasAwsCredentials) {
                this.skip();
            }
            return test.call(this);
        };
    };

    before(async () => {
        if (hasAwsCredentials) {
            await s3Client
                .createBucket({
                    Bucket: s3Bucket,
                    CreateBucketConfiguration: {
                        LocationConstraint: "eu-west-1",
                    },
                })
                .promise();
            console.log(`Created bucket ${s3Bucket}`);

            await Promise.all(
                fileNames.map((fileName) =>
                    s3Client
                        .putObject({
                            Bucket: s3Bucket,
                            Key: fileName,
                            Body: fileName,
                        })
                        .promise()
                )
            );
            console.log(`Uploaded ${fileNames.length} files to bucket`);
        }
    });

    after(async () => {
        if (hasAwsCredentials) {
            const fileDeletePromises = [];
            for (const fileName of fileNames) {
                fileDeletePromises.push(
                    s3Client
                        .deleteObject({ Bucket: s3Bucket, Key: fileName })
                        .promise()
                );
            }
            await Promise.all(fileDeletePromises);
            console.log(`Deleted ${fileNames.length} files from bucket`);

            await s3Client.deleteBucket({ Bucket: s3Bucket }).promise();
            console.log(`Deleted bucket ${s3Bucket}`);
        }
    });

    describe("getS3TarballUrlsAsync", () => {
        it(
            "Should list package tarballs in the bucket with prefix 'prefix/'",
            if_awscreds(async () => {
                const result = await getS3TarballNamesAsync(
                    s3Bucket,
                    "prefix/"
                );
                expect(result).to.have.deep.members(packageFileNamesWithPrefix);
            })
        );

        it(
            "Should list package tarballs in the bucket with prefix 'prefix'",
            if_awscreds(async () => {
                const result = await getS3TarballNamesAsync(s3Bucket, "prefix");
                expect(result).to.have.deep.members(packageFileNamesWithPrefix);
            })
        );

        it(
            "Should list package tarballs in the bucket without prefix",
            if_awscreds(async () => {
                const result = await getS3TarballNamesAsync(s3Bucket);
                expect(result).to.have.deep.members(packageFileNames);
            })
        );
    });
});
