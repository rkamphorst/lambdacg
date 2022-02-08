import { HandlerFactory } from "lambdacg-contract";
import fs from "node:fs/promises";

import { ProvideHandlerFactoriesAsyncFunction } from "./gateway-contract";

const getModuleNamesFromJsonFileAsync = async (filePath: string) => {
    const fileContents = (await fs.readFile(filePath)).toString("utf-8");

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

const importModuleAsHandlerFactoryAsyncOrThrow = async (
    moduleName: string
): Promise<HandlerFactory> => {
    const module: unknown = await import(moduleName);

    if (
        !(
            typeof module == "object" &&
            module !== null &&
            "default" in module &&
            typeof (module as { default: unknown }).default === "object" &&
            (module as { default: unknown }).default !== null
        )
    ) {
        throw new Error(
            `Expecting module "${moduleName}" default export to be an object, but it is not`
        );
    }

    const handlerFactory = (
        module as {
            default: {
                name?: string | unknown;
                canHandle?: (() => boolean) | unknown;
                createHandler?: (() => HandlerFactory) | unknown;
            };
        }
    ).default;
    const messageButIt = `Expecting module ${moduleName} default export to be a HandlerFactory, but it`;

    if (
        !(
            "name" in handlerFactory &&
            typeof (handlerFactory as HandlerFactory).name === "string"
        )
    ) {
        throw new Error(
            `${messageButIt} has no name property or name is undefined`
        );
    }

    if (
        !(
            "canHandle" in handlerFactory &&
            typeof (handlerFactory as HandlerFactory).canHandle === "function"
        )
    ) {
        throw new Error(`${messageButIt} has no canHandle() method`);
    }

    if (
        !(
            "createHandler" in handlerFactory &&
            typeof (handlerFactory as HandlerFactory).createHandler ===
                "function"
        )
    ) {
        throw new Error(`${messageButIt} has no createHandler() method`);
    }
    return handlerFactory as HandlerFactory;
};

let handlerFactoryListSource: (() => Promise<string[]>) | undefined = undefined;
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
                moduleNames.map(importModuleAsHandlerFactoryAsyncOrThrow)
            );
        }

        return handlerFactoryModules;
    };

export {
    getModuleNamesFromJsonFileAsync,
    provideHandlerFactoriesAsync,
    setHandlerFactoryListSource,
};
