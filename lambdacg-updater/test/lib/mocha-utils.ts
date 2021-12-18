import { Suite } from "mocha";

function describeObject(
    obj: { [key: string]: unknown },
    fn: (this: Suite) => void | Promise<void>
): void | Promise<void> {
    const key = Object.keys(obj)[0];
    describe(`${key}`, fn);
}

function describeMember<THost>(
    fnName: keyof THost,
    fn: (this: Suite) => void | Promise<void>
): void | Promise<void> {
    describe(`${fnName}`, fn);
}

const describeClass = describeObject;

export { describeObject, describeMember, describeClass };
