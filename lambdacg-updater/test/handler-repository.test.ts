import { expect } from "chai";
import { HandlerRepository } from "lambdacg-updater/handler-repository";
import {
    FolderInterface,
    FolderItemInterface,
} from "lambdacg-updater/handler-repository-contract";
import { PassThrough, Readable } from "node:stream";
import { mock, stub } from "sinon";

import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeMember } from "./lib/mocha-utils";
import { isReadStreamFinishedAsync } from "./lib/stream-utils";

class StubFolder implements FolderInterface {
    listLatestItemVersionsAsync(): Promise<FolderItemInterface[]> {
        return Promise.resolve([]);
    }
}

class StubFolderItem implements FolderItemInterface {
    get key(): string {
        return "";
    }
    get name(): string {
        return "";
    }
    get version(): string {
        return "";
    }
    getTagsAsync(): Promise<{ key: string; value: string }[]> {
        return Promise.resolve([]);
    }
    setTagsAsync(): Promise<void> {
        return Promise.resolve();
    }
    getDownloadStream(): Readable {
        const result = new PassThrough();
        result.end();
        return result;
    }
}

describe("HandlerRepository", function () {
    describeMember<HandlerRepository>("hasModulesToUpdate", function () {
        it("Should throw if called before initialization", async function () {
            const folder = new StubFolder();
            const sut = new HandlerRepository(folder, "updatedTagKey");
            await expectToThrowAsync(() => sut.hasModulesToUpdate());
        });

        it("Should return true if one folder item is a new version", async function () {
            const folderItems = [
                new StubFolderItem(),
                new StubFolderItem(),
                new StubFolderItem(),
            ];

            stub(folderItems[0], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[1], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[2], "getTagsAsync").returns(Promise.resolve([]));

            const folder = new StubFolder();
            stub(folder, "listLatestItemVersionsAsync").returns(
                Promise.resolve(folderItems)
            );

            const sut = new HandlerRepository(folder, "updatedTagKey");

            await sut.initializeWithLatestVersionsAsync();
            const result = sut.hasModulesToUpdate();

            expect(result).to.be.true;
        });

        it("Should return true if all folder items are a new version", async function () {
            const folderItems = [
                new StubFolderItem(),
                new StubFolderItem(),
                new StubFolderItem(),
            ];

            const folder = new StubFolder();
            stub(folder, "listLatestItemVersionsAsync").returns(
                Promise.resolve(folderItems)
            );

            const sut = new HandlerRepository(folder, "updatedTagKey");

            await sut.initializeWithLatestVersionsAsync();
            const result = sut.hasModulesToUpdate();

            expect(result).to.be.true;
        });

        it("Should return false if all folder items are up to date", async function () {
            const folderItems = [
                new StubFolderItem(),
                new StubFolderItem(),
                new StubFolderItem(),
            ];

            stub(folderItems[0], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[1], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[2], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );

            const folder = new StubFolder();
            stub(folder, "listLatestItemVersionsAsync").returns(
                Promise.resolve(folderItems)
            );

            const sut = new HandlerRepository(folder, "updatedTagKey");

            await sut.initializeWithLatestVersionsAsync();
            const result = sut.hasModulesToUpdate();

            expect(result).to.be.false;
        });
    });

    describeMember<HandlerRepository>(
        "getHandlerTarballStreamsAsync",
        function () {
            it("Should throw if called before initialization", async function () {
                const folder = new StubFolder();
                const sut = new HandlerRepository(folder, "updatedTagKey");
                await expectToThrowAsync(() =>
                    sut.getHandlerTarballStreamsAsync()
                );
            });

            it("Should return the name and stream for each folder item", async function () {
                const folderItems = [
                    new StubFolderItem(),
                    new StubFolderItem(),
                    new StubFolderItem(),
                ];

                stub(folderItems[0], "name").get(() => "a");
                stub(folderItems[0], "getDownloadStream").returns(
                    Readable.from(Buffer.from("a-content", "utf-8"))
                );
                stub(folderItems[1], "name").get(() => "b");
                stub(folderItems[1], "getDownloadStream").returns(
                    Readable.from(Buffer.from("b-content", "utf-8"))
                );
                stub(folderItems[2], "name").get(() => "c");
                stub(folderItems[2], "getDownloadStream").returns(
                    Readable.from(Buffer.from("c-content", "utf-8"))
                );

                const folder = new StubFolder();
                stub(folder, "listLatestItemVersionsAsync").returns(
                    Promise.resolve(folderItems)
                );

                const sut = new HandlerRepository(folder, "updatedTagKey");

                await sut.initializeWithLatestVersionsAsync();
                const result = await sut.getHandlerTarballStreamsAsync();

                const itemContents = await Promise.all(
                    result.map(async (x) => {
                        const buffers: Buffer[] = [];
                        x.stream.on("data", (data) => buffers.push(data));
                        await isReadStreamFinishedAsync(x.stream);
                        return {
                            name: x.tarballName,
                            contents: Buffer.concat(buffers).toString("utf-8"),
                        };
                    })
                );

                expect(itemContents).to.have.deep.members([
                    { name: "c", contents: "c-content" },
                    { name: "b", contents: "b-content" },
                    { name: "a", contents: "a-content" },
                ]);
            });
        }
    );

    describeMember<HandlerRepository>("markUpdatesAsync", function () {
        it("Should throw if called before initialization", async function () {
            const folder = new StubFolder();
            const sut = new HandlerRepository(folder, "updatedTagKey");
            await expectToThrowAsync(() => sut.markUpdatesAsync("updateTag"));
        });

        it("Should set exactly the marks on the items that need updates", async function () {
            const folderItems = [
                new StubFolderItem(),
                new StubFolderItem(),
                new StubFolderItem(),
                new StubFolderItem(),
            ];

            stub(folderItems[0], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[1], "getTagsAsync").returns(Promise.resolve([]));
            stub(folderItems[2], "getTagsAsync").returns(
                Promise.resolve([{ key: "updatedTagKey", value: "x" }])
            );
            stub(folderItems[3], "getTagsAsync").returns(
                Promise.resolve([{ key: "unknownKey", value: "y" }])
            );

            const mock0 = mock(folderItems[0]).expects("setTagsAsync").never();
            const mock1 = mock(folderItems[1])
                .expects("setTagsAsync")
                .once()
                .withArgs([{ key: "updatedTagKey", value: "z" }]);
            const mock2 = mock(folderItems[2]).expects("setTagsAsync").never();
            const mock3 = mock(folderItems[3])
                .expects("setTagsAsync")
                .once()
                .withArgs([
                    { key: "unknownKey", value: "y" },
                    { key: "updatedTagKey", value: "z" },
                ]);

            const folder = new StubFolder();
            stub(folder, "listLatestItemVersionsAsync").returns(
                Promise.resolve(folderItems)
            );

            const sut = new HandlerRepository(folder, "updatedTagKey");

            await sut.initializeWithLatestVersionsAsync();
            await sut.markUpdatesAsync("z");

            mock0.verify();
            mock1.verify();
            mock2.verify();
            mock3.verify();
        });
    });
});
