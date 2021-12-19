import { Readable } from "stream";

import {
    FolderInterface,
    FolderItemInterface,
} from "./handler-repository-contract";
import { HandlerRepositoryInterface } from "./updater-contract";

class HandlerRepository implements HandlerRepositoryInterface {
    #folder: FolderInterface;
    #itemsToUpdate:
        | {
              object: FolderItemInterface;
              tags: { key: string; value: string }[];
              isUpToDate: boolean;
          }[]
        | undefined = undefined;
    #updatedTagKey: string;

    constructor(folder: FolderInterface, updatedTagKey: string) {
        this.#folder = folder;
        this.#updatedTagKey = updatedTagKey;
    }

    async initializeWithLatestVersionsAsync(): Promise<void> {
        this.#itemsToUpdate = await Promise.all(
            (
                await this.#folder.listLatestItemVersionsAsync(
                    /(\.tar.gz|\.tgz)$/
                )
            ).map(async (folderItem) => {
                const tags = await folderItem.getTagsAsync();
                return {
                    object: folderItem,
                    tags: tags,
                    isUpToDate:
                        tags.findIndex((t) => t.key === this.#updatedTagKey) >=
                        0,
                };
            })
        );
    }

    hasModulesToUpdate(): boolean {
        if (this.#itemsToUpdate === undefined) {
            throw new Error("You have to initialize first");
        }
        return this.#itemsToUpdate.findIndex((x) => !x.isUpToDate) >= 0;
    }

    getHandlerTarballStreamsAsync(): Promise<
        { tarballName: string; stream: Readable }[]
    > {
        if (this.#itemsToUpdate === undefined) {
            throw new Error("You have to initialize first");
        }
        return Promise.resolve(
            this.#itemsToUpdate.map((o) => ({
                tarballName: o.object.name,
                stream: o.object.getDownloadStream(),
            }))
        );
    }

    async markUpdatesAsync(updateMarker: string): Promise<void> {
        if (this.#itemsToUpdate === undefined) {
            throw new Error("You have to initialize first");
        }

        await Promise.all(
            this.#itemsToUpdate
                .filter((x) => !x.isUpToDate)
                .map((x) =>
                    x.object.setTagsAsync(
                        x.tags.concat([
                            { key: this.#updatedTagKey, value: updateMarker },
                        ])
                    )
                )
        );
    }
}

export { HandlerRepository };
