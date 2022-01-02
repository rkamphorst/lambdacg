import { expect } from "chai";
import {
    S3RepositoryTarball,
    S3TarballRepository,
} from "lambdacg-updater/s3-tarball-repository";
import sinon from "sinon";

import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeClass, describeMember } from "./lib/mocha-utils";
import { S3ClientMock } from "./lib/s3-mock-utils";

const packageFileNames = [
    "tgz.file.tgz",
    "tar.gz.file.tar.gz",
    "tar.file.tar.gz",
];

describe("S3TarballRepository", async function () {
    describeClass({ S3TarballRepository }, function () {
        describe("fromUrl", function () {
            it("Should throw for URL s3://s3Bucket/prefix", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act & Assert
                await expectToThrowAsync(() =>
                    S3TarballRepository.fromUrl(
                        `s3://s3Bucket/prefix`,
                        s3ClientMock.object
                    )
                );
            });
            it("Should be successful for URL s3://s3Bucket/prefix/", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                // Assert
                expect(s3Repo).to.not.be.null;
                expect(s3Repo).to.be.instanceOf(S3TarballRepository);
            });
        });

        describeMember<S3TarballRepository>("initializeAsync", function () {
            it("Should fetch package tarball list in s3://s3Bucket/prefix/ in one batch", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const setupListObjectSpies =
                    s3ClientMock.setupListObjectVersions(
                        "prefix/",
                        packageFileNames.map((n) => `prefix/${n}`)
                    );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3TarballRepository.fromUrl(
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
                    expect(o).to.be.instanceOf(S3RepositoryTarball)
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
                const s3Repo = S3TarballRepository.fromUrl(
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
                    expect(o).to.be.instanceOf(S3RepositoryTarball)
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
                const s3Repo = S3TarballRepository.fromUrl(
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
                    expect(o).to.be.instanceOf(S3RepositoryTarball)
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
                const s3Repo = S3TarballRepository.fromUrl(
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
                    expect(o).to.be.instanceOf(S3RepositoryTarball)
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
                const s3Repo = S3TarballRepository.fromUrl(
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
                const s3Repo = S3TarballRepository.fromUrl(
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
                    expect(o).to.be.instanceOf(S3RepositoryTarball)
                );
                expect(result.map((o) => o.name)).to.have.deep.members([
                    packageFileNames[0],
                    packageFileNames[2],
                ]);
            });

            it("Should be up to date with latest update mark on tarballs", async function () {
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
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();

                // Assert
                expect(s3Repo.updateMark).to.be.equal("version2");
                expect(s3Repo.isUpToDate).to.be.true;
            });

            it("Should be not up to date if any tarball has undefined update mark", async function () {
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
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket`,
                    s3ClientMock.object
                );

                // Act
                await s3Repo.initializeAsync();

                // Assert
                expect(s3Repo.updateMark).to.be.undefined;
                expect(s3Repo.isUpToDate).to.be.false;
            });

            it("Should be up to date if there are no tarballs", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, []);
                s3ClientMock.setupGetObjectTagging(() => true, {});
                const s3Repo = S3TarballRepository.fromUrl(
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

        describeMember<S3TarballRepository>("isUpToDate", function () {
            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.isUpToDate);
            });
        });

        describeMember<S3TarballRepository>("updateMark", function () {
            it("Should contain latest update mark of a tarball", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, [
                    "key1.tgz",
                    "key2.tgz",
                ]);
                s3ClientMock.setupGetObjectTagging("key1.tgz", {
                    "lambdacg-update": "1991-01-01T01:00:00Z",
                });
                s3ClientMock.setupGetObjectTagging("key2.tgz", {
                    "lambdacg-update": "1991-01-01T01:01:00Z",
                });
                const s3Repo = S3TarballRepository.fromUrl(
                    "s3://s3Bucket",
                    s3ClientMock.object
                );
                await s3Repo.initializeAsync();

                // Act & Assert
                expect(s3Repo.updateMark).to.be.equal("1991-01-01T01:01:00Z");
                expect(s3Repo.isUpToDate).to.be.true;
            });

            it("Should be undefined if any tarball has no update mark", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(undefined, [
                    "key1.tgz",
                    "key2.tgz",
                ]);
                s3ClientMock.setupGetObjectTagging("key1.tgz", {
                    "lambdacg-update": "1991-01-01T01:00:00Z",
                });
                s3ClientMock.setupGetObjectTagging("key2.tgz", {});
                const s3Repo = S3TarballRepository.fromUrl(
                    "s3://s3Bucket",
                    s3ClientMock.object
                );
                await s3Repo.initializeAsync();

                // Act & Assert
                expect(s3Repo.updateMark).to.be.undefined;
                expect(s3Repo.isUpToDate).to.be.false;
            });

            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                // Assert
                expectToThrowAsync(() => s3Repo.updateMark);
            });
        });

        describeMember<S3TarballRepository>("tarballs", function () {
            it("Should throw if initialize not called", function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.tarballs);
            });
        });

        describeMember<S3TarballRepository>("markUpdatedAsync", function () {
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

                const s3Repo = S3TarballRepository.fromUrl(
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
                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                expectToThrowAsync(() => s3Repo.markUpdatedAsync());
            });
        });
    });

    describeClass({ S3RepositoryTarball }, function () {
        describe("constructor", function () {
            it("Should throw for URL s3://s3Bucket/object/key/", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act & Assert
                await expectToThrowAsync(
                    () =>
                        new S3RepositoryTarball(
                            { Bucket: "s3Bucket", Key: "object/key/" },
                            s3ClientMock.object
                        )
                );
            });
            it("Should be successful for URL s3://s3Bucket/object/key", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();

                // Act
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "object/key.tgz" },
                    s3ClientMock.object
                );

                // Assert
                expect(s3Tarball).to.not.be.null;
                expect(s3Tarball).to.be.instanceOf(S3RepositoryTarball);
                expect(s3Tarball.name).to.be.equal("key.tgz");
            });
        });

        describeMember<S3RepositoryTarball>(
            "hasCompleteVersionInfo",
            function () {
                it("Should succeed if latest version is added and is not a delete marker", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    s3Tarball.addVersion({
                        Key: "key.tgz",
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T00:00:00Z"),
                        VersionId: "latest-version",
                    });
                    const callbackSpy = sinon.spy();

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.true;
                    sinon.assert.notCalled(callbackSpy);
                });
                it("Should fail if latest version is not added", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    s3Tarball.addVersion({
                        Key: "key.tgz",
                        IsLatest: false,
                        LastModified: new Date("1990-01-01T00:00:00Z"),
                        VersionId: "latest-version",
                    });
                    const callbackSpy = sinon.spy();

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.false;
                    sinon.assert.called(callbackSpy);
                });
                it("Should fail if no version set at all", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    const callbackSpy = sinon.spy();

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.false;
                    sinon.assert.called(callbackSpy);
                });
                it("Should succeed if latest added version is delete marker and previous version is not", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    const callbackSpy = sinon.spy();
                    s3Tarball.addDeleteMarker({
                        Key: "key.tgz",
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T00:00:00Z"),
                        VersionId: "latest-version",
                    });
                    s3Tarball.addVersion({
                        Key: "key.tgz",
                        IsLatest: false,
                        LastModified: new Date("1989-01-01T00:00:00Z"),
                        VersionId: "previous-version",
                    });

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.true;
                    sinon.assert.notCalled(callbackSpy);
                    expect(s3Tarball.isDeleted).to.be.true;
                });
                it("Should fail if latest added version is delete marker and no previous version", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    const callbackSpy = sinon.spy();
                    s3Tarball.addDeleteMarker({
                        Key: "key.tgz",
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T00:00:00Z"),
                        VersionId: "latest-version",
                    });

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.false;
                    sinon.assert.called(callbackSpy);
                });
                it("Should fail if latest added version is delete marker and previous is also delete marker", function () {
                    // Arrange
                    const s3ClientMock = new S3ClientMock();
                    const s3Tarball = new S3RepositoryTarball(
                        { Bucket: "s3Bucket", Key: "key.tgz" },
                        s3ClientMock.object
                    );
                    const callbackSpy = sinon.spy();
                    s3Tarball.addDeleteMarker({
                        Key: "key.tgz",
                        IsLatest: true,
                        LastModified: new Date("1990-01-01T00:00:00Z"),
                        VersionId: "latest-version",
                    });
                    s3Tarball.addDeleteMarker({
                        Key: "key.tgz",
                        IsLatest: false,
                        LastModified: new Date("1989-02-01T00:00:00Z"),
                        VersionId: "previous-version",
                    });
                    s3Tarball.addVersion({
                        Key: "key.tgz",
                        IsLatest: false,
                        LastModified: new Date("1989-01-01T00:00:00Z"),
                        VersionId: "previous-version",
                    });

                    // Act
                    const result =
                        s3Tarball.hasCompleteVersionInfo(callbackSpy);

                    // Assert
                    expect(result).to.be.false;
                    sinon.assert.called(callbackSpy);
                });
            }
        );

        describeMember<S3RepositoryTarball>("getUpdateMarkAsync", function () {
            it("Should get update mark from latest version tags", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const getObjectTaggingSpy = s3ClientMock.setupGetObjectTagging(
                    { VersionId: "latest-version" },
                    { "lambdacg-update": "1992-01-01T02:00:01Z" }
                );

                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "blah.tgz" },
                    s3ClientMock.object
                );
                s3Tarball.addVersion({
                    Key: "blah.tgz",
                    IsLatest: true,
                    VersionId: "latest-version",
                    LastModified: new Date("1992-01-01T01:00:00Z"),
                });

                const result = await s3Tarball.getUpdateMarkAsync();

                expect(result).to.be.equal("1992-01-01T02:00:01Z");
                sinon.assert.calledOnce(s3ClientMock.object.getObjectTagging);
                sinon.assert.calledOnce(getObjectTaggingSpy);
            });
            it("Should return undefined if latest version has no tags", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const getObjectTaggingSpy = s3ClientMock.setupGetObjectTagging(
                    { VersionId: "latest-version" },
                    {}
                );
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "blah.tgz" },
                    s3ClientMock.object
                );
                s3Tarball.addVersion({
                    Key: "blah.tgz",
                    IsLatest: true,
                    VersionId: "latest-version",
                    LastModified: new Date("1992-01-01T01:00:00Z"),
                });

                // Act
                const result = await s3Tarball.getUpdateMarkAsync();

                // Assert
                expect(result).to.be.undefined;
                sinon.assert.calledOnce(s3ClientMock.object.getObjectTagging);
                sinon.assert.calledOnce(getObjectTaggingSpy);
            });
            it("Should get update mark from previous version tags if deleted", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const getObjectTaggingPreviousVersionSpy =
                    s3ClientMock.setupGetObjectTagging(
                        { VersionId: "previous-version" },
                        { "lambdacg-deletion": "1992-01-01T02:00:01Z" }
                    );
                const getObjectTaggingLatestversionSpy = s3ClientMock
                    .setupGetObjectTagging({ VersionId: "latest-version" }, {})
                    .throws(new Error());
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "blah.tgz" },
                    s3ClientMock.object
                );
                s3Tarball.addDeleteMarker({
                    Key: "blah.tgz",
                    IsLatest: true,
                    VersionId: "latest-version",
                    LastModified: new Date("1992-01-01T01:00:00Z"),
                });
                s3Tarball.addVersion({
                    Key: "blah.tgz",
                    IsLatest: false,
                    VersionId: "previous-version",
                    LastModified: new Date("1992-01-01T00:59:00Z"),
                });

                // Act
                const result = await s3Tarball.getUpdateMarkAsync();

                // Assert
                expect(result).to.be.equal("1992-01-01T02:00:01Z");
                sinon.assert.calledOnce(getObjectTaggingPreviousVersionSpy);
                sinon.assert.notCalled(getObjectTaggingLatestversionSpy);
                sinon.assert.calledOnce(s3ClientMock.object.getObjectTagging);
            });
            it("Should return undefined if previous version tags empty and deleted", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const getObjectTaggingPreviousVersionSpy =
                    s3ClientMock.setupGetObjectTagging(
                        { VersionId: "previous-version" },
                        {}
                    );
                const getObjectTaggingLatestversionSpy = s3ClientMock
                    .setupGetObjectTagging({ VersionId: "latest-version" }, {})
                    .throws(new Error());
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "blah.tgz" },
                    s3ClientMock.object
                );
                s3Tarball.addDeleteMarker({
                    Key: "blah.tgz",
                    IsLatest: true,
                    VersionId: "latest-version",
                    LastModified: new Date("1992-01-01T01:00:00Z"),
                });
                s3Tarball.addVersion({
                    Key: "blah.tgz",
                    IsLatest: false,
                    VersionId: "previous-version",
                    LastModified: new Date("1992-01-01T00:59:00Z"),
                });

                // Act
                const result = await s3Tarball.getUpdateMarkAsync();

                // Assert
                expect(result).to.be.undefined;
                sinon.assert.calledOnce(getObjectTaggingPreviousVersionSpy);
                sinon.assert.notCalled(getObjectTaggingLatestversionSpy);
                sinon.assert.calledOnce(s3ClientMock.object.getObjectTagging);
            });
        });

        describeMember<S3RepositoryTarball>("markUpdatedAsync", function () {
            it("Should mark current version", async function () {
                // Arrange
                const s3ClientMock = new S3ClientMock();
                const putObjectTaggingSpy = s3ClientMock.setupPutObjectTagging(
                    { Key: "object/key", VersionId: "latest-version" },
                    { "lambdacg-update": "update-mark" }
                );
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
                );
                s3Tarball.addVersion({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });

                // Act
                s3Tarball.markUpdatedAsync("update-mark");

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
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
                );
                s3Tarball.addVersion({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });
                s3Tarball.addVersion({
                    Key: "object/key",
                    IsLatest: false,
                    LastModified: new Date("1990-01-01T00:59:00Z"),
                    VersionId: "previous-version",
                });

                // Act
                s3Tarball.markUpdatedAsync("update-mark");

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
                const s3Tarball = new S3RepositoryTarball(
                    { Bucket: "s3Bucket", Key: "object/key" },
                    s3ClientMock.object
                );
                s3Tarball.addDeleteMarker({
                    Key: "object/key",
                    IsLatest: true,
                    LastModified: new Date("1990-01-01T01:00:00Z"),
                    VersionId: "latest-version",
                });
                s3Tarball.addVersion({
                    Key: "object/key",
                    IsLatest: false,
                    LastModified: new Date("1990-01-01T00:59:00Z"),
                    VersionId: "previous-version",
                });

                // Act
                s3Tarball.markUpdatedAsync("update-mark");

                // Assert
                sinon.assert.calledOnce(s3ClientMock.object.putObjectTagging);
                sinon.assert.calledOnce(putObjectTaggingPreviousSpy);
            });
        });

        describeMember<S3RepositoryTarball>("getDownloadStream", function () {
            it("Should correctly download the contents of an object", async function () {
                const s3ClientMock = new S3ClientMock();
                s3ClientMock.setupListObjectVersions(
                    "prefix/",
                    packageFileNames.map((n) => `prefix/${n}`)
                );
                s3ClientMock.setupGetObjectTagging(() => true, {});
                s3ClientMock.setupGetObject(() => true, "content-of-object");

                const s3Repo = S3TarballRepository.fromUrl(
                    `s3://s3Bucket/prefix/`,
                    s3ClientMock.object
                );

                await s3Repo.initializeAsync();
                const s3Tarball = s3Repo.tarballs.filter(
                    (x) => x.name == "tar.gz.file.tar.gz"
                )[0];

                const stream = s3Tarball.getDownloadStream();

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
