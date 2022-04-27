import { expect } from "chai";
import mockFs from "mock-fs";
import fs from "node:fs";
import path from "node:path";
import streamEqualAsync from "stream-equal";

import { getAssetStream } from "../src/assets";
import { streamToStringAsync } from "../src/stream-utils";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

describe("Assets", function () {
    describeObject({ getAssetStream }, function () {
        it("Should open a stream for existing asset", async function () {
            const readable = getAssetStream("resolver-package.tgz");

            const streamsAreEqual = await streamEqualAsync(
                readable,
                fs.createReadStream(
                    path.resolve(
                        __dirname,
                        "..",
                        "assets",
                        "resolver-package.tgz"
                    )
                )
            );

            expect(streamsAreEqual, "Streams have equal content").to.be.true;
        });
    });

    describeObject({ getAssetStream }, () => {
        before(function () {
            mockFs({
                "not-in-a-package": {},
                "package-root": {
                    "package.json": "{}",
                    assets: {
                        "my-asset.txt": "awesome asset",
                    },
                    dir1: {
                        dir2: {},
                    },
                },
            });
        });

        after(function () {
            mockFs.restore();
        });

        it("Should open a stream for existing asset from package root", async function () {
            const readable = getAssetStream("my-asset.txt", "package-root");

            const contents = await streamToStringAsync(readable);

            expect(contents).to.be.equal("awesome asset");
        });
        it("Should open a stream for existing asset from one level under package root", async function () {
            const readable = getAssetStream(
                "my-asset.txt",
                path.join("package-root", "dir1")
            );

            const contents = await streamToStringAsync(readable);

            expect(contents).to.be.equal("awesome asset");
        });
        it("Should open a stream for existing asset from two levels under package root", async function () {
            const readable = getAssetStream(
                "my-asset.txt",
                path.join("package-root", "dir1", "dir2")
            );

            const contents = await streamToStringAsync(readable);

            expect(contents).to.be.equal("awesome asset");
        });
        it("Should throw if relative directory does not exist", async function () {
            const readable = getAssetStream(
                "my-asset.txt",
                path.join("package-root", "does-not-exist")
            );

            await expectToThrowAsync(() => streamToStringAsync(readable));
        });
        it("Should throw if relative directory is outside package", async function () {
            const readable = getAssetStream("my-asset.txt", "not-in-a-package");

            await expectToThrowAsync(() => streamToStringAsync(readable));
        });
        it("Should throw asset does not exist", async function () {
            const readable = getAssetStream(
                "nonexisting-asset.txt",
                "package-root"
            );

            await expectToThrowAsync(() => streamToStringAsync(readable));
        });
    });
});
