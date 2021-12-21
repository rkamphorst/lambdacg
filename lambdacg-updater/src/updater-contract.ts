import { Readable } from "node:stream";

interface HandlerRepositoryInterface {
    initializeWithLatestVersionsAsync(): Promise<void>;

    hasModulesToUpdate(): boolean;

    getHandlerTarballStreamsAsync(): Promise<
        { tarballName: string; stream: Readable }[]
    >;

    markUpdatesAsync(updateMarker: string): Promise<void>;
}

interface ResolverPackageInterface {
    addHandlerFromTarballStream(
        tarballName: string,
        tarballStream: Readable
    ): void;

    createLambdaCodeZipStreamAsync(): Promise<Readable>;

    cleanupAsync(): Promise<void>;
}

interface UpdaterInterface {
    updateToLatestHandlersAsync(): Promise<void>;
}

export {
    HandlerRepositoryInterface,
    ResolverPackageInterface,
    UpdaterInterface,
};
