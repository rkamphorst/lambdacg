import { ProvideHandlerFactoriesAsyncFunction } from "./handler-factory-provider-contract";
import { HandlerFactory } from "lambdacg-contract";
import fs from "node:fs/promises";
import path from "node:path";

const getModuleNamesFromFileAsync = async (filePath: string) => {
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

const moduleAsHandlerFactoryOrThrow = (
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

let handlerFactoryModules: HandlerFactory[] | undefined = undefined;

const provideHandlerFactoriesAsync: ProvideHandlerFactoriesAsyncFunction =
    async () => {
        if (handlerFactoryModules === undefined) {
            const moduleNames = await getModuleNamesFromFileAsync(
                path.join(__dirname, "handlerFactories.json")
            );

            handlerFactoryModules = await Promise.all(
                moduleNames.map(async (name) =>
                    moduleAsHandlerFactoryOrThrow(name, await import(name))
                )
            );
        }

        return handlerFactoryModules;
    };

export { provideHandlerFactoriesAsync };
