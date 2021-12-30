import { Readable } from "node:stream";

interface HandlerRepositoryInterface {
    initializeAsync(): Promise<void>;

    get isUpToDate(): boolean;

    get tarballs(): HandlerTarballInterface[];

    markUpdatedAsync(): Promise<string>;
}

interface HandlerTarballInterface {
    get name(): string;

    getDownloadStream(): Readable;
}

interface ResolverPackageInterface {
    addHandlerTarball(handlerTarball: HandlerTarballInterface): void;

    createLambdaCodeZipStreamAsync(): Promise<Readable>;

    cleanupAsync(): Promise<void>;
}

interface UpdaterInterface {
    updateToLatestHandlersAsync(): Promise<void>;
}

export {
    HandlerRepositoryInterface,
    HandlerTarballInterface,
    ResolverPackageInterface,
    UpdaterInterface,
};
