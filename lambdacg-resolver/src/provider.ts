import { ProviderInterface } from "./provider-contract";

class ProviderFromImport<TProvided> implements ProviderInterface<TProvided> {
    #getModuleNamesAsync: () => Promise<string[]>;
    #modules: TProvided[] | undefined;

    constructor(getModuleNamesAsync: () => Promise<string[]>) {
        this.#getModuleNamesAsync = getModuleNamesAsync;
    }

    async provideAsync(): Promise<TProvided[]> {
        if (!this.#modules) {
            const moduleNames: string[] = await this.#getModuleNamesAsync();

            this.#modules = await Promise.all(
                moduleNames.map(
                    async (name) => (await import(name)) as TProvided
                )
            );
        }
        return this.#modules;
    }
}

export { ProviderFromImport };
