import { expect } from "chai";

import {
    getBucketAndKeyFromS3ObjectUrl,
    getBucketAndPrefixFromS3FolderUrl,
} from "../src/s3-utils";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

describe("S3Utils", async function () {
    // these tests are over the network and can be quite slow.
    // therefore we set long timeout and long slowness theshold
    this.timeout("15s");
    this.slow("10s");

    describe("S3Utils", function () {
        describeObject({ getBucketAndPrefixFromS3FolderUrl }, function () {
            it("Should throw for URL s3://[s3Bucket]/prefix", async function () {
                await expectToThrowAsync(() =>
                    getBucketAndPrefixFromS3FolderUrl(`s3://s3-bucket/prefix`)
                );
            });
            it("Should be successful for URL s3://[s3Bucket]/prefix/", async function () {
                const s3Folder = getBucketAndPrefixFromS3FolderUrl(
                    `s3://s3-bucket/prefix/`
                );
                expect(s3Folder).to.not.be.null;
                expect(s3Folder).to.be.deep.equal({
                    Bucket: "s3-bucket",
                    Prefix: "prefix/",
                });
            });
        });

        describeObject({ getBucketAndKeyFromS3ObjectUrl }, function () {
            it("Should throw for URL s3://[s3Bucket]/object/key/", async function () {
                await expectToThrowAsync(() =>
                    getBucketAndKeyFromS3ObjectUrl(`s3://s3-bucket/object/key/`)
                );
            });
            it("Should be successful for URL s3://[s3Bucket]/object/key", async function () {
                const s3Object = getBucketAndKeyFromS3ObjectUrl(
                    `s3://s3-bucket/object/key`
                );
                expect(s3Object).to.not.be.null;
                expect(s3Object).to.be.deep.equal({
                    Bucket: "s3-bucket",
                    Key: "object/key",
                });
            });
        });
    });
});
