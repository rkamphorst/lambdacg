import { Readable } from "node:stream";

interface TarballRepositoryInterface {
    initializeAsync(): Promise<void>;

    get isUpToDate(): boolean;

    get tarballs(): RepositoryTarballInterface[];

    markUpdatedAsync(): Promise<string>;
}

interface RepositoryTarballInterface {
    get name(): string;

    getDownloadStream(): Readable;
}

interface ResolverPackageInterface {
    addHandlerTarball(handlerTarball: RepositoryTarballInterface): void;

    createCodeZipAsync(): Promise<Readable>;

    cleanupAsync(): Promise<void>;
}

interface UpdateTargetInterface {
    updateCodeAsync(zipStream: Readable): Promise<void>;
}
interface UpdaterInterface {
    updateToLatestHandlersAsync(): Promise<void>;
}

export {
    RepositoryTarballInterface,
    ResolverPackageInterface,
    TarballRepositoryInterface,
    UpdaterInterface,
    UpdateTargetInterface,
};
