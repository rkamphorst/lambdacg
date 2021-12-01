import { expect } from "chai";
import sinon from 'sinon';
import { Gateway } from 'lambdacg-resolver/gateway';
import { ComposeFunction } from 'lambdacg-resolver/composer-contract';
import { ExecuteAsyncFunction } from 'lambdacg-resolver/executor-contract';
import { HandlerFactory } from 'lambdacg-contract'

describe("Gateway", () => {

    it("Should call compose and execute", async () => {
        const composeStub = sinon.stub().returns("composeResponse");
        const compose: ComposeFunction = composeStub;

        const executeAsyncStub = sinon.stub().returns(Promise.resolve(["executeResponse"]));
        const executeAsync: ExecuteAsyncFunction = executeAsyncStub;

        const handlerFactories: HandlerFactory[] = [];

        const gateway = new Gateway(handlerFactories, executeAsync, compose);

        const result = await gateway.handleRequestAsync({
            execution: "execution",
            requestName: "requestName",
            requestParams: "requestParameters",
            responseTemplate: "responseTemplate"
        });

        expect(result).to.be.deep.equal({ success: true, response: "composeResponse" });
        expect(executeAsyncStub.calledOnceWith("execution", handlerFactories, "requestName", "requestParameters")).to.be.true;
        expect(composeStub.calledOnceWith("responseTemplate", ["executeResponse"])).to.be.true;
    });

    it("Should call compose and execute with non-supplied parameters", async () => {
        const composeStub = sinon.stub().returns("composeResponse");
        const compose: ComposeFunction = composeStub;

        const executeAsyncStub = sinon.stub().returns(Promise.resolve(["executeResponse"]));
        const executeAsync: ExecuteAsyncFunction = executeAsyncStub;

        const handlerFactories: HandlerFactory[] = [];

        const gateway = new Gateway(handlerFactories, executeAsync, compose);

        const result = await gateway.handleRequestAsync({
            requestName: "requestName"
        });

        expect(result).to.be.deep.equal({ success: true, response: "composeResponse" });
        expect(executeAsyncStub.calledOnceWith("all", handlerFactories, "requestName", {})).to.be.true;
        expect(composeStub.calledOnceWith({}, ["executeResponse"])).to.be.true;
    });

    it("Should respond with the error that execute throws", async () => {
        const composeStub = sinon.stub().returns("composeResponse");
        const compose: ComposeFunction = composeStub;

        const executeAsyncStub = sinon.stub().throws(new Error("executeAsyncError"));
        const executeAsync: ExecuteAsyncFunction = executeAsyncStub;

        const handlerFactories: HandlerFactory[] = [];

        const gateway = new Gateway(handlerFactories, executeAsync, compose);

        const result = await gateway.handleRequestAsync({
            requestName: "requestName"
        });

        expect(result.success).to.be.false;
        expect(executeAsyncStub.callCount == 1).to.be.true;
        expect(composeStub.callCount == 0).to.be.true;

        if (result.success === false) {
            expect(result.error).to.be.a("Error");
            const error = result.error as Error;
            expect(error.message).to.be.equal("executeAsyncError");
        }
    });

    it("Should respond with the error that execute rejects with", async () => {
        const composeStub = sinon.stub().returns("composeResponse");
        const compose: ComposeFunction = composeStub;

        const executeAsyncStub = sinon.stub().returns(Promise.reject(new Error("executeAsyncError")));
        const executeAsync: ExecuteAsyncFunction = executeAsyncStub;

        const handlerFactories: HandlerFactory[] = [];

        const gateway = new Gateway(handlerFactories, executeAsync, compose);

        const result = await gateway.handleRequestAsync({
            requestName: "requestName"
        });

        expect(result.success).to.be.false;
        expect(executeAsyncStub.callCount == 1).to.be.true;
        expect(composeStub.callCount == 0).to.be.true;

        if (result.success === false) {
            expect(result.error).to.be.a("Error");
            const error = result.error as Error;
            expect(error.message).to.be.equal("executeAsyncError");
        }
    });

    it("Should respond with the error that compose throws", async () => {
        const composeStub = sinon.stub().throws(new Error("composeError"));
        const compose: ComposeFunction = composeStub;

        const executeAsyncStub = sinon.stub().returns(Promise.resolve(["executeResponse"]));
        const executeAsync: ExecuteAsyncFunction = executeAsyncStub;

        const handlerFactories: HandlerFactory[] = [];

        const gateway = new Gateway(handlerFactories, executeAsync, compose);

        const result = await gateway.handleRequestAsync({
            requestName: "requestName"
        });

        expect(result.success).to.be.false;
        expect(executeAsyncStub.callCount == 1).to.be.true;
        expect(composeStub.callCount == 1).to.be.true;

        if (result.success === false) {
            expect(result.error).to.be.a("Error");
            const error = result.error as Error;
            expect(error.message).to.be.equal("composeError");
        }
    });


})
