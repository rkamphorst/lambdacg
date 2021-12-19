import "mocha";

import { expect } from "chai";
import { HandlerResponse } from "lambdacg-contract";
import { compose } from "lambdacg-resolver/composer";

describe("Composer", () => {
    it("Should compose two simple objects", () => {
        const template = {};
        const responses = [
            { a: 1, b: "banana" },
            { c: 2, d: "bla" },
        ];

        const result = compose(template, responses);

        expect(result).to.be.deep.equal({ a: 1, b: "banana", c: 2, d: "bla" });
    }),
        it("Should compose two complex objects", () => {
            const template = {};
            const responses = [
                { a: { bb: "aa" }, b: { c: { d: "e" } } },
                { a: { aa: "bb" }, b: { bb: "cc", c: { e: "f" } } },
                { c: "x" },
            ];

            const result = compose(template, responses);

            expect(result).to.be.deep.equal({
                a: { bb: "aa", aa: "bb" },
                b: { bb: "cc", c: { d: "e", e: "f" } },
                c: "x",
            });
        }),
        it("Should compose two simple arrays", () => {
            const template: HandlerResponse = {};
            const responses: HandlerResponse[] = [
                { x: ["a", "b", "c"] },
                { x: ["e", "f", "g"] },
            ];

            const result = compose(template, responses);

            expect(result).to.have.property("x");
            expect(result["x"]).to.have.members(["a", "b", "c", "f", "g", "e"]);
        }),
        it("Should compose two complex arrays", () => {
            const template: HandlerResponse = {};
            const responses: HandlerResponse[] = [
                { x: [{ a: { b: "c" } }, { d: { e: "f" } }] },
                { x: [{ a: { c: "b" } }, { d: { f: "e" } }] },
            ];

            const result = compose(template, responses);

            expect(result).to.have.property("x");
            expect(result["x"]).to.have.deep.members([
                { a: { b: "c" } },
                { d: { e: "f" } },
                { a: { c: "b" } },
                { d: { f: "e" } },
            ]);
        }),
        it("Should prefer later results over earlier results", () => {
            const template: HandlerResponse = {};
            const responses: HandlerResponse[] = [
                { x: "a", y: { x: "a" }, z: "y" },
                { x: "b", y: { x: "b" } },
            ];

            const result = compose(template, responses);

            expect(result).to.be.deep.equal({ x: "b", y: { x: "b" }, z: "y" });
        });
});
