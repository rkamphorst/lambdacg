import {
    ResolverPackageInterface,
    TarballRepositoryInterface,
    UpdaterInterface,
    UpdateTargetInterface,
} from "./updater-contract";

class Updater implements UpdaterInterface {
    #createTarballRepository: () => TarballRepositoryInterface;
    #createResolverPackage: () => ResolverPackageInterface;
    #createUpdateTarget: () => UpdateTargetInterface;

    constructor(
        createTarballRepository: () => TarballRepositoryInterface,
        createResolverPackage: () => ResolverPackageInterface,
        createUpdateTarget: () => UpdateTargetInterface
    ) {
        this.#createTarballRepository = createTarballRepository;
        this.#createResolverPackage = createResolverPackage;
        this.#createUpdateTarget = createUpdateTarget;
    }

    async updateToLatestHandlersAsync(): Promise<void> {
        const repo = this.#createTarballRepository();

        await repo.initializeAsync();

        if (repo.isUpToDate) {
            return;
        }

        const pkg = this.#createResolverPackage();
        const target = this.#createUpdateTarget();
        repo.tarballs.forEach((t) => pkg.addHandlerTarball(t));

        try {
            const code = await pkg.createCodeZipAsync();

            await target.updateCodeAsync(code);
        } finally {
            await pkg.cleanupAsync();
        }
    }
}

export { Updater };
