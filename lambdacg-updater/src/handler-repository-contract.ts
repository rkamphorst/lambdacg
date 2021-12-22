import { Readable } from "node:stream";

interface FolderInterface {
    listLatestItemVersionsAsync(nameRe: RegExp): Promise<FolderItemInterface[]>;
}

interface FolderItemInterface {
    get key(): string;

    get name(): string;

    get version(): string;

    get isDeleted(): boolean;

    getTagsAsync(): Promise<{ key: string; value: string }[]>;

    setTagsAsync(tags: { key: string; value: string }[]): Promise<void>;

    getDownloadStream(): Readable;
}

export { FolderInterface, FolderItemInterface };
