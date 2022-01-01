import { expect } from "chai";
import {
    S3HandlerRepository,
    S3HandlerTarball,
} from "lambdacg-updater/s3-handler-repository";
import sinon from "sinon";

import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { S3ClientMock } from "./lib/s3-mock-utils";

const packageFileNames = [
    "tgz.file.tgz",
    "tar.gz.file.tar.gz",
    "tar.file.tar.gz",
];

describe("S3HandlerRepository", async function () {
    describeClass({ S3HandlerRepository }, function () {
        describe("fromUrl", function () {
            it("Should throw for URL s3://s3Bucket/prefix", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act & Assert
                await expectToThrowAsync(() =>
                    S3HandlerRepository.fromUrl(
                        `s3://s3Bucket/prefix`,
                        s3ClientMock.object
                    )
                );
            });
            it("Should be successful for URL s3://s3Bucket/prefix/", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                // Assert
                expect(s3Repo).to.not.be.null;
                expect(s3Repo).to.be.instanceOf(S3HandlerRepository);
            });
        });

        describeMember<S3HandlerRepository>("initializeAsync", function () {
            it("Should fetch package tarball list in s3://s3Bucket/prefix/ in one batch", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const setupListObjectSpies =
                    s3ClientMock.setupListObjectVersions(
                        "prefix/",
                        packageFileNames.map((n) => `prefix/${n}`)
                    );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();
                const result = s3Repo.tarballs;

                // Assert
                setupListObjectSpies.forEach((s) => sinon.assert.calledOnce(s));
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
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const setupListObjectSpies =
                    s3ClientMock.setupListObjectVersions(
                        "prefix/",
                        ...packageFileNames.map((n) => [`prefix/${n}`])
                    );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();
                const result = s3Repo.tarballs;

                // Assert
                setupListObjectSpies.forEach((s) => sinon.assert.calledOnce(s));
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
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(
                    undefined,
                    packageFileNames.map((n) => `${n}`)
                );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();
                const result = s3Repo.tarballs;

                // Assert
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
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(
                    undefined,
                    packageFileNames.map((n) => `${n}`)
                );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();
                const result = s3Repo.tarballs;

                // Assert
                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(packageFileNames.length);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members(
                    packageFileNames
                );
            });

            it("Should execute only once", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(
                    undefined,
                    packageFileNames.map((n) => `${n}`)
                );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                const promise1 = s3Repo.initializeAsync();
                await promise1;
                const promise2 = s3Repo.initializeAsync();

                // Assert
                expect(
                    promise1 === promise2,
                    "The same promise is returned"
                ).to.be.true;
            });

            it("Should drop tarballs that have incomplete version info", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, [
                    packageFileNames[0],
                    {
                        Key: packageFileNames[1],
                        VersionId: "not-latest",
                        IsLatest: false,
                    },
                    packageFileNames[2],
                ]);
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();
                const result = s3Repo.tarballs;

                // Assert
                expect(result).to.not.be.null;
                expect(result.length).to.be.equal(2);
                result.forEach((o) =>
                    expect(o).to.be.instanceOf(S3HandlerTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members([
                    packageFileNames[0],
                    packageFileNames[2],
                ]);
            });

            it("Should assume the latest set update mark on tarballs", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, [
                    packageFileNames[0],
                    packageFileNames[1],
                ]);
                s3ClientMock.setupGetObjectTagging(packageFileNames[0], {
                    "lambdacg-update": "version1",
                });
                s3ClientMock.setupGetObjectTagging(packageFileNames[1], {
                    "lambdacg-update": "version2",
                });
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();

                // Assert
                expect(s3Repo.updateMark).to.be.equal("version2");
                expect(s3Repo.isUpToDate).to.be.true;
            });

            it("Should assume undefined update mark if any tarball has undefined update mark", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, [
                    packageFileNames[0],
                    packageFileNames[1],
                ]);
                s3ClientMock.setupGetObjectTagging(packageFileNames[0], {});
                s3ClientMock.setupGetObjectTagging(packageFileNames[1], {
                    "lambdacg-update": "version2",
                });
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();

                // Assert
                expect(s3Repo.updateMark).to.be.undefined;
                expect(s3Repo.isUpToDate).to.be.false;
            });

            it("Should assume undefined update mark but up to date if there are no tarballs", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, []);
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();

                // Assert
                expect(s3Repo.tarballs).to.be.empty;
                expect(s3Repo.updateMark).to.be.undefined;
                expect(s3Repo.isUpToDate).to.be.true;
            });
        });

        describeMember<S3HandlerRepository>("isUpToDate", function () {
            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.isUpToDate);
            });
        });

        describeMember<S3HandlerRepository>("updateMark", function () {
            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.updateMark);
            });
        });

        describeMember<S3HandlerRepository>("tarballs", function () {
            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.tarballs);
            });
        });

        describeMember<S3HandlerRepository>("markUpdatedAsync", function () {
            it("Should mark only tarballs that were updated", async function () {
                const s3ClientMock = new S3ClientMock();

                s3ClientMock.setupListObjectVersions(undefined, [
                    {
                        Key: "key1.tgz",
                        VersionId: "latest-version",
                        IsDeleted: false,
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T01:00:00Z"),
                    },
                    {
                        Key: "key1.tgz",
                        VersionId: "previous-version",
                        IsDeleted: false,
                        IsLatest: false,
                        LastModified: new Date("1990-01-01T00:59:00Z"),
                    },
                    {
                        Key: "key2.tgz",
                        VersionId: "latest-version",
                        IsDeleted: false,
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T01:05:00Z"),
                    },
                    {
                        Key: "key3.tgz",
                        VersionId: "latest-version",
                        IsDeleted: true,
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T01:10:00Z"),
                    },
                    {
                        Key: "key3.tgz",
                        VersionId: "previous-version",
                        IsDeleted: false,
                        IsLatest: false,
                        LastModified: new Date("1990-01-01T01:08:00Z"),
                    },
                ]);

                s3ClientMock.setupGetObjectTagging(
                    { Key: "key1.tgz", VersionId: "previous-version" },
                    { "lambdacg-update": "1990-01-01T01:01:00Z" }
                );
                s3ClientMock.setupGetObjectTagging(
                    { Key: "key1.tgz", VersionId: "latest-version" },
                    { "lambdacg-update": "1990-01-01T01:02:00Z" }
                );
                s3ClientMock.setupGetObjectTagging(
                    { Key: "key2.tgz", VersionId: "latest-version" },
                    {}
                );
                s3ClientMock.setupGetObjectTagging(
                    { Key: "key3.tgz", VersionId: "previous-version" },
                    { "lambdacg-deletion": "1990-01-01T01:02:00Z" }
                );

                const putObjectTaggingSpy = s3ClientMock.setupPutObjectTagging({
                    Key: "key2.tgz",
                    VersionId: "latest-version",
                });

                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                await s3Repo.initializeAsync();

                expect(s3Repo.isUpToDate).to.be.false;
                expect(s3Repo.updateMark).to.be.undefined;

                await s3Repo.markUpdatedAsync();

                expect(s3Repo.isUpToDate).to.be.true;
                expect(s3Repo.updateMark).to.not.be.null;
                sinon.assert.calledOnce(s3ClientMock.object.putObjectTagging);
                sinon.assert.calledOnce(putObjectTaggingSpy);
            });

            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.markUpdatedAsync());
            });
        });
    });

    describeClass({ S3HandlerTarball }, function () {
        describe("constructor", function () {
            it("Should throw for URL s3://s3Bucket/object/key/", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act & Assert
                await expectToThrowAsync(
                    () =>
                        new S3HandlerTarball(
                            { Bucket: "s3Bucket", Key: "object/key/" },
                            s3ClientMock.object
                        )
                );
            });
            it("Should be successful for URL s3://s3Bucket/object/key", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
                );

                // Assert
                expect(s3Object).to.not.be.null;
                expect(s3Object).to.be.instanceOf(S3HandlerTarball);
            });
        });

        describeMember<S3HandlerTarball>("markUpdatedAsync", function () {
            it("Should mark current version", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const putObjectTaggingSpy = s3ClientMock.setupPutObjectTagging(
                    { Key: "object/key", VersionId: "latest-version" },
                    { "lambdacg-update": "update-mark" }
                );
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
                );
                s3Object.addVersion({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });

                // Act
                s3Object.markUpdatedAsync("update-mark");

                // Assert
                sinon.assert.calledOnce(s3ClientMock.object.putObjectTagging);
                sinon.assert.calledOnce(putObjectTaggingSpy);
            });

            it("Should clear mark on previous version if present", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const putObjectTaggingCurrentSpy =
                    s3ClientMock.setupPutObjectTagging(
                        { Key: "object/key", VersionId: "latest-version" },
                        {
                            "lambdacg-update": "update-mark",
                            "lambdacg-deletion": undefined,
                        }
                    );
                const putObjectTaggingPreviousSpy =
                    s3ClientMock.setupPutObjectTagging(
                        { Key: "object/key", VersionId: "previous-version" },
                        {
                            "lambdacg-update": undefined,
                            "lambdacg-deletion": undefined,
                        }
                    );
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
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

                // Act
                s3Object.markUpdatedAsync("update-mark");

                // Assert
                sinon.assert.calledTwice(s3ClientMock.object.putObjectTagging);
                sinon.assert.calledOnce(putObjectTaggingCurrentSpy);
                sinon.assert.calledOnce(putObjectTaggingPreviousSpy);
            });

            it("Should only mark previous version if deleted", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const putObjectTaggingPreviousSpy =
                    s3ClientMock.setupPutObjectTagging(
                        { Key: "object/key", VersionId: "previous-version" },
                        {
                            "lambdacg-deletion": "update-mark",
                            "lambdacg-update": undefined,
                        }
                    );
                const s3Object = new S3HandlerTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
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

                // Act
                s3Object.markUpdatedAsync("update-mark");

                // Assert
                sinon.assert.calledOnce(s3ClientMock.object.putObjectTagging);
                sinon.assert.calledOnce(putObjectTaggingPreviousSpy);
            });
        });

        describeMember<S3HandlerTarball>("getDownloadStream", function () {
            it("Should correctly download the contents of an object", async function () {
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(
                    "prefix/",
                    packageFileNames.map((n) => `prefix/${n}`)
                );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                s3ClientMock.setupGetObject(() => true, "content-of-object");

                const s3Repo = S3HandlerRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                await s3Repo.initializeAsync();
                const s3Object = s3Repo.tarballs.filter(
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
