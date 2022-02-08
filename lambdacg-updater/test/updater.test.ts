import sinon from "sinon";
import { PassThrough, Readable } from "stream";

import { Updater } from "../src/updater";
import {
    RepositoryTarballInterface,
    ResolverPackageInterface,
    TarballRepositoryInterface,
    UpdateTargetInterface,
} from "../src/updater-contract";
import { describeMember, describeObject } from "./lib/mocha-utils";

class StubTarballRepo implements TarballRepositoryInterface {
    initializeAsync() {
        return Promise.resolve();
    }

    get isUpToDate() {
        return false;
    }
    get tarballs() {
        return [];
    }
    markUpdatedAsync() {
        return Promise.resolve("new-version");
    }
}

class StubTarball implements RepositoryTarballInterface {
    get name(): string {
        return "name";
    }
    getDownloadStream(): Readable {
        const result = new PassThrough();
        result.end();
        return result;
    }
}

class StubResolverPackage implements ResolverPackageInterface {
    addHandlerTarball() {
        return;
    }

    createCodeZipAsync() {
        const result = new PassThrough();
        result.end();
        return Promise.resolve(result);
    }
    cleanupAsync() {
        return Promise.resolve();
    }
}

class StubUpdateTarget implements UpdateTargetInterface {
    updateCodeAsync() {
        return Promise.resolve();
    }
}

describe("Updater", function () {
    describeObject({ Updater }, function () {
        describeMember<Updater>("updateToLatestHandlersAsync", function () {
            it("Should update the target if no tarballs added", async function () {
                const stubRepo = new StubTarballRepo();
                sinon.stub(stubRepo, "isUpToDate").get(() => false);

                const stubResolverPackage = new StubResolverPackage();
                const addTarballSpy = sinon.spy(
                    stubResolverPackage,
                    "addHandlerTarball"
                );

                const stubUpdateTarget = new StubUpdateTarget();
                const updateCodeSpy = sinon.spy(
                    stubUpdateTarget,
                    "updateCodeAsync"
                );

                const sut = new Updater(
                    () => stubRepo,
                    () => stubResolverPackage,
                    () => stubUpdateTarget
                );

                await sut.updateToLatestHandlersAsync();

                sinon.assert.notCalled(addTarballSpy);
                sinon.assert.calledOnce(updateCodeSpy);
            });

            it("Should update the target if some tarballs added", async function () {
                const stubRepo = new StubTarballRepo();
                sinon.stub(stubRepo, "isUpToDate").get(() => false);
                sinon
                    .stub(stubRepo, "tarballs")
                    .get(() => [new StubTarball(), new StubTarball()]);

                const stubResolverPackage = new StubResolverPackage();
                const addTarballSpy = sinon.spy(
                    stubResolverPackage,
                    "addHandlerTarball"
                );

                const stubUpdateTarget = new StubUpdateTarget();
                const updateCodeSpy = sinon.spy(
                    stubUpdateTarget,
                    "updateCodeAsync"
                );

                const sut = new Updater(
                    () => stubRepo,
                    () => stubResolverPackage,
                    () => stubUpdateTarget
                );

                await sut.updateToLatestHandlersAsync();

                sinon.assert.calledTwice(addTarballSpy);
                sinon.assert.calledOnce(updateCodeSpy);
            });

            it("Should not update the target if already up to date", async function () {
                const stubRepo = new StubTarballRepo();
                sinon.stub(stubRepo, "isUpToDate").get(() => true);
                sinon
                    .stub(stubRepo, "tarballs")
                    .get(() => [new StubTarball(), new StubTarball()]);

                const stubResolverPackage = new StubResolverPackage();
                const addTarballSpy = sinon.spy(
                    stubResolverPackage,
                    "addHandlerTarball"
                );

                const stubUpdateTarget = new StubUpdateTarget();
                const updateCodeSpy = sinon.spy(
                    stubUpdateTarget,
                    "updateCodeAsync"
                );

                const sut = new Updater(
                    () => stubRepo,
                    () => stubResolverPackage,
                    () => stubUpdateTarget
                );

                await sut.updateToLatestHandlersAsync();

                sinon.assert.notCalled(addTarballSpy);
                sinon.assert.notCalled(updateCodeSpy);
            });
        });
    });
});
