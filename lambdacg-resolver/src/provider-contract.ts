interface ProviderInterface<TProvided> {
    provideAsync(): Promise<TProvided[]>;
}

export { ProviderInterface };
