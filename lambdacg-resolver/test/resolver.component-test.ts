import { AssertionError, expect } from "chai";
import path from "path";

import { GatewayRequest, GatewayResponse } from "../src/gateway-contract";

const dataDir = path.join(__dirname, "data", "resolver.component-test");

describe("Resolver (component test)", function () {
    let invokeResolverAsync: (
        rq: GatewayRequest
    ) => Promise<GatewayResponse> = () => Promise.resolve({ success: true });
    const handler1 = path.join(dataDir, "handler1");
    const handler2 = path.join(dataDir, "handler2");

    before(async function () {
        process.env["HANDLER_FACTORIES"] = `${handler1},${handler2}`;
        const { handler } = await import("../src/index");
        invokeResolverAsync = handler;
    });

    it("Should invoke the handlers", async function () {
        const result = await invokeResolverAsync({
            requestName: "request",
            execution: "all",
        });

        if (result.success !== true) {
            throw new AssertionError("Expecting successful result");
        }

        if (!result.response) {
            throw new AssertionError("Expecting a response");
        }

        const response = result.response;
        expect(
            "handler1" in response ? response["handler1"] : undefined
        ).to.be.equal("handler1");
        expect(
            "handler2" in response ? response["handler2"] : undefined
        ).to.be.equal("handler2");
    });

    it("Should pass parameters combine responses", async function () {
        const result = await invokeResolverAsync({
            requestName: "request",
            execution: "all",
            requestParams: {
                echo: "echo echo echo",
            },
        });

        if (result.success !== true) {
            throw new AssertionError("Expecting successful result");
        }

        if (!result.response) {
            throw new AssertionError("Expecting a response");
        }

        const response = result.response;

        if (!("object" in response)) {
            throw new AssertionError(
                "Expecting 'object' property in  response"
            );
        }

        expect(response["object"]).to.be.deep.equal({
            handler1Echo: "handler1 echoes echo echo echo",
            handler1: "handler1",
            handler2Echo: "handler2 echoes echo echo echo",
            handler2: "handler2",
            nested: {
                handler1: "handler1",
                handler2: "handler2",
            },
        });

        if (!("array" in response)) {
            throw new AssertionError("Expecting 'array' property in  response");
        }

        expect(response["array"]).to.have.deep.members([
            "handler1",
            { handler2: "handler2" },
        ]);
    });

    it("Should return unsuccessful response if handler throws", async function () {
        const result = await invokeResolverAsync({
            requestName: "handler1Throws",
            execution: "all",
        });

        if (result.success !== false) {
            throw new AssertionError("Expecting unsuccessful result");
        }

        const error = result.error;

        if (!(error instanceof Error)) {
            throw new AssertionError("Expecting error to be of type Error");
        }
        expect(error.message).to.be.equal("handler1");
    });

    it("Should return unsuccessful response if no handlers with execution type all", async function () {
        const result = await invokeResolverAsync({
            requestName: "unknown",
            execution: "all",
        });

        if (result.success !== false) {
            throw new AssertionError("Expecting unsuccessful result");
        }
    });

    it("Should return successful response if no handlers with execution type optional", async function () {
        const result = await invokeResolverAsync({
            requestName: "unknown",
            execution: "optional",
        });

        if (result.success !== true) {
            throw new AssertionError("Expecting successful result");
        }
    });
});
