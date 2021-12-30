import { S3 } from "aws-sdk";
import { expect } from "chai";
import {
    S3HandlerRepository,
    S3HandlerTarball,
} from "lambdacg-updater/s3-handler-repository";
import sinon from "sinon";

import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { S3ClientStub } from "./lib/s3-stub-utils";

const packageFileNames = [
    "tgz.file.tgz",
    "tar.gz.file.tar.gz",
    "tar.file.tar.gz",
];

describe("S3HandlerRepository", async function () {
    describeClass({ S3HandlerRepository }, function () {
        describe("fromUrl", function () {
            it("Should throw for URL s3://s3Bucket/prefix", async function () {
                const s3ClientStub = new S3ClientStub();
                await expectToThrowAsync(() =>
                    S3HandlerRepository.fromUrl(
                        `s3://s3Bucket/prefix`,
                        s3ClientStub.object
                    )
                );
            });
            it("Should be successful for URL s3://s3Bucket/prefix/", async function () {
                const s3ClientStub = new S3ClientStub();
                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientStub.object
                );
                expect(s3Folder).to.not.be.null;
                expect(s3Folder).to.be.instanceOf(S3HandlerRepository);
            });
        });

        describeMember<S3HandlerRepository>("initializeAsync", function () {
            it("Should fetch package tarball list in s3://s3Bucket/prefix/ in one batch", async function () {
                const s3ClientStub = new S3ClientStub();

                s3ClientStub.setupListObjectVersions(
                    "prefix/",
                    packageFileNames.map((n) => `prefix/${n}`)
                );
                s3ClientStub.setupGetObjectTagging({});

                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientStub.object
                );

                await s3Folder.initializeAsync();
                const result = s3Folder.tarballs;

                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(3);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members(
                    packageFileNames
                );
            });

            it("Should fetch package tarball list in s3://s3Bucket/prefix/ in multiple batches", async function () {
                const s3ClientStub = new S3ClientStub();

                s3ClientStub.setupListObjectVersions(
                    "prefix/",
                    ...packageFileNames.map((n) => [`prefix/${n}`])
                );
                s3ClientStub.setupGetObjectTagging({});

                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientStub.object
                );

                await s3Folder.initializeAsync();
                const result = s3Folder.tarballs;

                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(3);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members(
                    packageFileNames
                );
            });

            it("Should fetch package tarball list in s3://s3Bucket/", async function () {
                const s3ClientStub = new S3ClientStub();

                s3ClientStub.setupListObjectVersions(
                    undefined,
                    packageFileNames.map((n) => `${n}`)
                );
                s3ClientStub.setupGetObjectTagging({});

                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/`,
                    s3ClientStub.object
                );

                await s3Folder.initializeAsync();
                const result = s3Folder.tarballs;

                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(packageFileNames.length);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members(
                    packageFileNames
                );
            });

            it("Should fetch package tarball list in s3://s3Bucket", async function () {
                const s3ClientStub = new S3ClientStub();

                s3ClientStub.setupListObjectVersions(
                    undefined,
                    packageFileNames.map((n) => `${n}`)
                );
                s3ClientStub.setupGetObjectTagging({});

                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientStub.object
                );

                await s3Folder.initializeAsync();
                const result = s3Folder.tarballs;

                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(packageFileNames.length);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members(
                    packageFileNames
                );
            });
        });
    });

    describeClass({ S3HandlerTarball }, function () {
        describe("constructor", function () {
            it("Should throw for URL s3://s3Bucket/object/key/", async function () {
                const s3ClientStub = new S3ClientStub();
                await expectToThrowAsync(
                    () =>
                        new S3HandlerTarball(
                            { Bucket: "s3Bucket", Key: "object/key/" },
                            s3ClientStub.object
                        )
                );
            });
            it("Should be successful for URL s3://s3Bucket/object/key", async function () {
                const s3ClientStub = new S3ClientStub();
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientStub.object
                );
                expect(s3Object).to.not.be.null;
                expect(s3Object).to.be.instanceOf(S3HandlerTarball);
            });
        });

        describeMember<S3HandlerTarball>("markUpdatedAsync", function () {
            it("Should mark current version", async function () {
                const s3ClientStub = new S3ClientStub();
                s3ClientStub.setupPutObjectTagging();
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientStub.object
                );
                s3Object.addVersion({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });

                s3Object.markUpdatedAsync("update-mark");

                const latestVersionMarked =
                    s3ClientStub.object.putObjectTagging.calledOnceWith(
                        sinon.match(
                            (r: S3.PutObjectTaggingRequest) =>
                                r.Key == "object/key" &&
                                r.VersionId == "latest-version" &&
                                r.Tagging.TagSet.findIndex(
                                    (t) =>
                                        t.Key == "lambdacg-update" &&
                                        t.Value == "update-mark"
                                ) >= 0
                        )
                    );
                expect(
                    latestVersionMarked,
                    "Latest version was marked"
                ).to.be.true;
            });

            it("Should mark previous version if present", async function () {
                const s3ClientStub = new S3ClientStub();
                s3ClientStub.setupPutObjectTagging();
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientStub.object
                );

                s3Object.addVersion({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });
                s3Object.addVersion({
                    Key: "object/key",
                    IsLatest: false,
                    LastModified: new Date("1990-01-01T00:59:00Z"),
                    VersionId: "previous-version",
                });

                s3Object.markUpdatedAsync("update-mark");

                sinon.assert.calledWith(
                    s3ClientStub.object.putObjectTagging,
                    sinon.match(
                        (r: S3.PutObjectTaggingRequest) =>
                            r.Key == "object/key" &&
                            r.VersionId == "latest-version" &&
                            r.Tagging.TagSet.length == 1 &&
                            r.Tagging.TagSet[0].Key == "lambdacg-update" &&
                            r.Tagging.TagSet[0].Value == "update-mark"
                    )
                );
                sinon.assert.calledWith(
                    s3ClientStub.object.putObjectTagging,
                    sinon.match(
                        (r: S3.PutObjectTaggingRequest) =>
                            r.Key == "object/key" &&
                            r.VersionId == "previous-version" &&
                            r.Tagging.TagSet.length == 0
                    )
                );
            });

            it("Should only mark previous version if deleted", async function () {
                const s3ClientStub = new S3ClientStub();
                s3ClientStub.setupPutObjectTagging();
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientStub.object
                );

                s3Object.addDeleteMarker({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });
                s3Object.addVersion({
                    Key: "object/key",
                    IsLatest: false,
                    LastModified: new Date("1990-01-01T00:59:00Z"),
                    VersionId: "previous-version",
                });

                s3Object.markUpdatedAsync("update-mark");

                sinon.assert.calledOnce(s3ClientStub.object.putObjectTagging);
                sinon.assert.calledWith(
                    s3ClientStub.object.putObjectTagging,
                    sinon.match(
                        (r: S3.PutObjectTaggingRequest) =>
                            r.Key == "object/key" &&
                            r.VersionId == "previous-version" &&
                            r.Tagging.TagSet.length == 1 &&
                            r.Tagging.TagSet[0].Key == "lambdacg-deletion" &&
                            r.Tagging.TagSet[0].Value == "update-mark"
                    )
                );
            });
        });

        describeMember<S3HandlerTarball>("getDownloadStream", function () {
            it("Should correctly download the contents of an object", async function () {
                const s3ClientStub = new S3ClientStub();
                s3ClientStub.setupListObjectVersions(
                    "prefix/",
                    packageFileNames.map((n) => `prefix/${n}`)
                );
                s3ClientStub.setupGetObjectTagging({});
                s3ClientStub.setupGetObject("content-of-object");

                const s3Folder = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientStub.object
                );

                await s3Folder.initializeAsync();
                const s3Object = s3Folder.tarballs.filter(
                    (x) => x.name == "tar.gz.file.tar.gz"
                )[0];

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
                            resolve(Buffer.concat(buffers).toString("utf-8"));
                        }
                    });
                });

                stream.resume();
                const result = await promise;

                expect(result).to.be.equal("content-of-object");
            });
        });
    });
});
