
import {Readable} from "node:stream";

interface HandlerRepositoryInterface {

    initializeWithLatestVersionsAsync(): Promise<void>;

    hasModulesToUpdate(): boolean;

    getHandlerTarballStreamsAsync(): Promise<{tarballName:string,stream:Readable}[]>;

    markUpdatesAsync(updateMarker:string): Promise<void>;

}

interface ResolverStagingInterface {

    addHandlerFromTarballStreamAsync(tarballName:string, stream:Readable): Promise<void>;

    createDeploymentZipStreamAsync(): Promise<Readable>;

}

interface UpdaterInterface {

    updateToLatestHandlersAsync(): Promise<void>;

}

export {
    HandlerRepositoryInterface,
    ResolverStagingInterface,
    UpdaterInterface
}
