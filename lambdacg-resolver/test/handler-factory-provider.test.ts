import { expect } from "chai";
import mockFs from "mock-fs";
import path from "node:path";

import {
    getModuleNamesFromJsonFileAsync,
    provideHandlerFactoriesAsync,
    setHandlerFactoryListSource,
} from "../src/handler-factory-provider";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

const dataDir = path.join(__dirname, "data", "handler-factory-provider.test");

describe("Handler Factory Provider", function () {
    describeObject({ getModuleNamesFromJsonFileAsync }, function () {
        before(function () {
            mockFs({
                "valid.json": '[ "handler1", "handler2", "handler3" ]',
                "invalidJson.json": '{ "handlers": ["handler1", "handler2" ] }',
                "moduleNameIsObject.json": '[ "handler1", "handler2", { } ]',
                "moduleNameIsNumber.json": '[ "handler1", "handler2", 3 ]',
                "moduleNameIsBoolean.json": '[ "handler1", "handler2", false ]',
                "moduleNameIsNull.json": '[ "handler1", "handler2", null ]',
                "notJson.csv": "handler1\nhandler2\nhandler3",
            });
        });

        after(function () {
            mockFs.restore();
        });

        it("Should read a valid handler factories from JSON", async function () {
            const moduleNames = await getModuleNamesFromJsonFileAsync(
                "valid.json"
            );

            expect(moduleNames).to.have.deep.members([
                "handler1",
                "handler3",
                "handler2",
            ]);
        });

        it("Should throw if handler factory JSON is in bad format", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("invalidJson.json")
            );
        });

        it("Should throw if handler factory JSON has object as module name", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("moduleNameIsObject.json")
            );
        });

        it("Should throw if handler factory JSON has number as module name", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("moduleNameIsNumber.json")
            );
        });

        it("Should throw if handler factory JSON has boolean as module name", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("moduleNameIsBoolean.json")
            );
        });

        it("Should throw if handler factory JSON has null as module name", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("moduleNameIsNull.json")
            );
        });

        it("Should throw if handler factory file is not in JSON format", async function () {
            await expectToThrowAsync(() =>
                getModuleNamesFromJsonFileAsync("notJson.csv")
            );
        });
    });

    describeObject({ provideHandlerFactoriesAsync }, function () {
        it("Should provide valid handler factory", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([path.join(dataDir, "handler-factory-stub")])
            );

            // Act
            const result = await provideHandlerFactoriesAsync();

            // Assert
            expect(result).to.have.length(1);
            expect(result[0].name).to.be.equal("handler-factory-stub");
            expect(result[0].canHandle).be.a("function");
            expect(result[0].createHandler).to.be.a("function");
        });

        it("Should import handler factories only once", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([path.join(dataDir, "handler-factory-stub")])
            );

            // Act
            const result = await provideHandlerFactoriesAsync();
            const result2 = await provideHandlerFactoriesAsync();

            // Assert
            expect(result).to.have.length(1);
            expect(result2).to.have.length(1);
            expect(
                result[0] === result2[0],
                "Handler factories are the same object"
            ).to.be.true;
        });

        it("Should throw if handler factory list source not set", async function () {
            // Arrange
            // (this is a hack to set the list source to undefined)
            setHandlerFactoryListSource(
                undefined as unknown as () => Promise<string[]>
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if no default export", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(
                        dataDir,
                        "handler-factory-stub-no-default-export"
                    ),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has no name property", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(dataDir, "handler-factory-stub-no-name"),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has name property that is not a string", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(dataDir, "handler-factory-stub-name-not-string"),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has no canHandle property", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(dataDir, "handler-factory-stub-no-can-handle"),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has canHandle property that is not a function", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(
                        dataDir,
                        "handler-factory-stub-can-handle-no-function"
                    ),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has no createHandler property", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(
                        dataDir,
                        "handler-factory-stub-no-create-handler"
                    ),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });

        it("Should throw if default export has createHandler property that is not a function", async function () {
            // Arrange
            setHandlerFactoryListSource(() =>
                Promise.resolve([
                    path.join(
                        dataDir,
                        "handler-factory-stub-create-handler-no-function"
                    ),
                ])
            );

            // Act & Assert
            await expectToThrowAsync(() => provideHandlerFactoriesAsync());
        });
    });
});
