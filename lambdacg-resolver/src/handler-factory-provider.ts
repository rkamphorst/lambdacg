import { ProvideHandlerFactoriesAsyncFunction } from "./gateway-contract";
import { HandlerFactory } from "lambdacg-contract";
import fs from "node:fs/promises";

const getModuleNamesFromJsonFileAsync = async (filePath: string) => {
    const fileContents = (
        await fs.readFile(`${__dirname}/${filePath}`)
    ).toString("utf-8");

    const shouldBeArray = JSON.parse(fileContents);
    if (!(shouldBeArray instanceof Array)) {
        throw new Error(`JSON in ${filePath} is not an array`);
    }

    const shouldHaveOnlyStrings = shouldBeArray as unknown[];
    shouldHaveOnlyStrings.forEach((s, i) => {
        if (!(typeof s == "string")) {
            throw new Error(
                `JSON in array ${filePath} has a non-string value at index ${i}: ${s}`
            );
        }
    });

    const listOfStrings = shouldHaveOnlyStrings as string[];
    return listOfStrings;
};

const importModuleAsHandlerFactoryOrThrow = (
    moduleName: string,
    module: unknown
): HandlerFactory => {
    const messageButIt = `Expecting module ${moduleName} to be a HandlerFactory, but it `;
    if (typeof module !== "object" || module === null) {
        throw new Error(`${messageButIt} has type '${typeof module}'`);
    }

    if (
        !(
            "name" in module &&
            typeof (module as HandlerFactory).name !== "string"
        )
    ) {
        throw new Error(
            `${messageButIt} has no name property or name is undefined`
        );
    }

    if (
        !(
            "canHandle" in module &&
            typeof (module as HandlerFactory).canHandle !== "function"
        )
    ) {
        throw new Error(`${messageButIt} has no canHandle() method`);
    }

    if (
        !(
            "createHandler" in module &&
            typeof (module as HandlerFactory).createHandler !== "function"
        )
    ) {
        throw new Error(`${messageButIt} has no createHandler() method`);
    }
    return module as HandlerFactory;
};

let handlerFactoryListSource: () => Promise<string[]> | undefined = undefined;
let handlerFactoryModules: HandlerFactory[] | undefined = undefined;

const setHandlerFactoryListSource = (callback: () => Promise<string[]>) => {
    handlerFactoryListSource = callback;
    handlerFactoryModules = undefined;
};

const provideHandlerFactoriesAsync: ProvideHandlerFactoriesAsyncFunction =
    async () => {
        if (!handlerFactoryListSource) {
            throw new Error(
                "No handler factory list source was set (use setHandlerFactoryListSource())"
            );
        }

        if (!handlerFactoryModules) {
            const moduleNames = await handlerFactoryListSource();

            handlerFactoryModules = await Promise.all(
                moduleNames.map(async (name) =>
                    importModuleAsHandlerFactoryOrThrow(
                        name,
                        await import(name)
                    )
                )
            );
        }

        return handlerFactoryModules;
    };

export {
    provideHandlerFactoriesAsync,
    setHandlerFactoryListSource,
    getModuleNamesFromJsonFileAsync,
};
