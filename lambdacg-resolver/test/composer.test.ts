import "mocha";

import { expect } from "chai";
import { HandlerResponse } from "lambdacg-contract";

import { compose } from "../src/composer";

describe("Composer", () => {
    it("Should compose two simple objects", () => {
        const template = {};
        const responses = [
            { a: 1, b: "banana" },
            { c: 2, d: "bla" },
        ];

        const result = compose(template, responses);

        expect(result).to.be.deep.equal({ a: 1, b: "banana", c: 2, d: "bla" });
    });
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
    });
    it("Should compose two simple arrays", () => {
        const template: HandlerResponse = {};
        const responses: HandlerResponse[] = [
            { x: ["a", "b", "c"] },
            { x: ["e", "f", "g"] },
        ];

        const result = compose(template, responses);

        expect(result).to.have.property("x");
        expect(result["x"]).to.have.members(["a", "b", "c", "f", "g", "e"]);
    });
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
    });
    it("Should prefer later values over earlier values", () => {
        const template: HandlerResponse = {};
        const responses: HandlerResponse[] = [
            { x: "a", y: { x: "a" }, z: "y" },
            { x: "b", y: { x: "b" } },
        ];

        const result = compose(template, responses);

        expect(result).to.be.deep.equal({ x: "b", y: { x: "b" }, z: "y" });
    });
    it("Should prefer later types over earlier types", () => {
        const template: HandlerResponse = {};
        const responses: HandlerResponse[] = [
            { a: 1, b: {}, c: [], d: { a: 1, b: { a: "a" }, c: [] } },
            { a: {}, b: [], c: "bla", d: { a: "bla", b: { b: "b" }, c: 1 } },
        ];

        const result = compose(template, responses);

        expect(result).to.be.deep.equal({
            a: {},
            b: [],
            c: "bla",
            d: { a: "bla", b: { a: "a", b: "b" }, c: 1 },
        });
    });
    it("Should prefer non-nil over nil objects", () => {
        const template = {};
        const responses = [
            undefined as unknown as HandlerResponse,
            { a: 1, b: "banana" },
            null as unknown as HandlerResponse,
            { c: 2, d: null },
            undefined as unknown as HandlerResponse,
            { e: 3, d: "bla" },
        ];

        const result = compose(template, responses);

        expect(result).to.be.deep.equal({
            a: 1,
            b: "banana",
            c: 2,
            d: "bla",
            e: 3,
        });
    });
});
