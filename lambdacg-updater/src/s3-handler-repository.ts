import { Readable } from "stream";
import { HandlerRepositoryInterface } from "./updater-contract";
import { S3Folder, S3Object } from "./s3-utils";

class S3HandlerRepository implements HandlerRepositoryInterface {
    #s3Folder: S3Folder;
    #s3ObjectsUpToDate:
        | {
              object: S3Object;
              tags: { key: string; value: string }[];
              isUpToDate: boolean;
          }[]
        | undefined = undefined;
    #updatedTagKey: string;

    constructor(s3Folder: S3Folder, updatedTagKey: string) {
        this.#s3Folder = s3Folder;
        this.#updatedTagKey = updatedTagKey;
    }

    async initializeWithLatestVersionsAsync(): Promise<void> {
        this.#s3ObjectsUpToDate = await Promise.all(
            (
                await this.#s3Folder.listLatestObjectVersionsAsync(
                    /(\.tar.gz|\.tgz)$/
                )
            ).map(async (s3Object) => {
                const tags = await s3Object.getTagsAsync();
                return {
                    object: s3Object,
                    tags: tags,
                    isUpToDate:
                        tags.findIndex((t) => t.key === this.#updatedTagKey) >=
                        0,
                };
            })
        );
    }

    hasModulesToUpdate(): boolean {
        if (this.#s3ObjectsUpToDate === undefined) {
            throw new Error("You have to initialize first");
        }
        return this.#s3ObjectsUpToDate.findIndex((x) => !x.isUpToDate) >= 0;
    }

    getHandlerTarballStreamsAsync(): Promise<
        { tarballName: string; stream: Readable }[]
    > {
        if (this.#s3ObjectsUpToDate === undefined) {
            throw new Error("You have to initialize first");
        }
        return Promise.resolve(
            this.#s3ObjectsUpToDate.map((o) => ({
                tarballName: o.object.name,
                stream: o.object.getDownloadStream(),
            }))
        );
    }

    async markUpdatesAsync(updateMarker: string): Promise<void> {
        if (this.#s3ObjectsUpToDate === undefined) {
            throw new Error("You have to initialize first");
        }

        await Promise.all(
            this.#s3ObjectsUpToDate
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

export { S3HandlerRepository };
