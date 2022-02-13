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

type ResolverPackageInfo = {
    name: string;
    main: string;
    version: string;
};

type ResolverCodeZip = {
    packageInfo: ResolverPackageInfo;
    handlerFactories: string[];
    stream: Readable;
};

interface ResolverPackageInterface {
    addHandlerTarball(handlerTarball: RepositoryTarballInterface): void;

    createCodeZipAsync(): Promise<ResolverCodeZip>;

    cleanupAsync(): Promise<void>;
}

interface UpdateTargetInterface {
    updateCodeAsync(codeZip: ResolverCodeZip): Promise<void>;
}
interface UpdaterInterface {
    updateToLatestHandlersAsync(): Promise<void>;
}

export {
    RepositoryTarballInterface,
    ResolverCodeZip,
    ResolverPackageInfo,
    ResolverPackageInterface,
    TarballRepositoryInterface,
    UpdaterInterface,
    UpdateTargetInterface,
};
