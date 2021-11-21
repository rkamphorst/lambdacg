import { HandlerFactory } from "lambdacg-contract"
import { executeAsync } from "lambdacg-resolver/executor";
import {assert, expect} from "chai"
import sinon from 'sinon';

describe("Executor", () => {

    it("Should throw if execution not supported", async () => {

        const handlerStub = sinon.stub().returns({ responseProperty: "responsePropertyValue" });
        const factory = createHandlerFactory("factory", () => true, handlerStub);

        await expectToThrowAsync(
            () => executeAsync("notSupported", [ factory ], "name", { "param1": "value1" }),
            e => e instanceof Error, "e instanceof Error"
        );
        
    });
    
    describe("execution: 'optional'", () => {
        const execution = "optional";
    
        executionShouldCallOneHandler(execution);
        executionShouldCallMultipleHandlers(execution);
        executionShouldReturnEmptArrayIfZeroHandlers(execution);
        executionShouldThrowIfHandlerThrows(execution);
        executionShouldThrowIfHandlerReturnsRejectedPromise(execution);
    });

    describe("execution: 'single'", () => {
        const execution = "single";
    
        executionShouldCallOneHandler(execution);
        executionShouldThrowIfMultipleHandlers(execution);
        executionShouldThrowIfZeroHandlers(execution);
        executionShouldThrowIfHandlerThrows(execution);
        executionShouldThrowIfHandlerReturnsRejectedPromise(execution);
    });
    
    describe("execution: 'all'", () => {
        const execution = "all";
    
        executionShouldCallOneHandler(execution);
        executionShouldCallMultipleHandlers(execution);
        executionShouldThrowIfZeroHandlers(execution);
        executionShouldThrowIfHandlerThrows(execution);
        executionShouldThrowIfHandlerReturnsRejectedPromise(execution);
    
    });
});



function executionShouldCallOneHandler(execution: string) : void 
{
    it(`Should call one supported handler and return the result`, async () => {

        const handlerA = sinon.stub().returns({ a: "x" });
        const handlerB = sinon.stub().returns({ b: "x" });
        const factories = [
            createHandlerFactory("a", () => true, handlerA),
            createHandlerFactory("b", () => false, handlerB),
        ];

        const result = await executeAsync(execution, factories, "name", { "param1": "value1" });
    
        expect(result).to.have.deep.members([{a:"x"}]);
        expect(handlerA.callCount).to.be.eql(1);
        expect(handlerB.callCount).to.be.eql(0);
    });
}

function executionShouldThrowIfHandlerThrows(execution: string) : void 
{
    it(`Should throw if a handler throws`, async () => {

        const thrownObject = {};
        const handlerA = sinon.stub().throws(thrownObject);
        const handlerB = sinon.stub().returns({ b: "x" });
        const factories = [
            createHandlerFactory("a", () => true, handlerA),
            createHandlerFactory("b", () => false, handlerB),
        ];

        await expectToThrowAsync(
            () => executeAsync(execution, factories, "name", { "param1": "value1" }),
            e => e === thrownObject, "e is the thing thrown from the handler"
        );
        expect(handlerA.callCount).to.be.equal(1);
        expect(handlerB.callCount).to.be.equal(0);
    });
}

function executionShouldThrowIfHandlerReturnsRejectedPromise(execution: string) : void 
{
    it(`Should throw if a handler returns rejected promise`, async () => {

        const handlerA = sinon.stub().returns(Promise.reject(new Error("my-exception")));
        const handlerB = sinon.stub().returns({ b: "x" });
        const factories = [
            createHandlerFactory("a", () => true, handlerA),
            createHandlerFactory("b", () => false, handlerB),
        ];

        await expectToThrowAsync(
            () => executeAsync(execution, factories, "name", { "param1": "value1" }),
            e => e instanceof Error, "e instanceof Error"
        );
    });
}

function executionShouldCallMultipleHandlers(execution: string) : void 
{
    it(`Should call multiple supported handlers and return the results`, async () => {

        const handlerA = sinon.stub().returns({ a: "x" });
        const handlerB = sinon.stub().returns({ b: "x" });
        const handlerC = sinon.stub().returns({ c: "x" });
        const factories = [
            createHandlerFactory("a", () => true, handlerA),
            createHandlerFactory("b", () => false, handlerB),
            createHandlerFactory("c", () => true, handlerC)
        ];

        const result = await executeAsync(execution, factories, "name", { "param1": "value1" });
    
        expect(result).to.have.deep.members([{a:"x"}, {c:"x"}]);
        expect(handlerA.callCount).to.be.eql(1);
        expect(handlerB.callCount).to.be.eql(0);
        expect(handlerC.callCount).to.be.eql(1);
    });
}

function executionShouldThrowIfMultipleHandlers(execution: string) : void 
{
    it(`Should throw if multiple supported handlers`, async () => {

        const handlerA = sinon.stub().returns({ a: "x" });
        const handlerB = sinon.stub().returns({ b: "x" });
        const handlerC = sinon.stub().returns({ c: "x" });
        const factories = [
            createHandlerFactory("a", () => true, handlerA),
            createHandlerFactory("b", () => false, handlerB),
            createHandlerFactory("c", () => true, handlerC)
        ];


        await expectToThrowAsync(
            () => executeAsync(execution, factories, "name", { "param1": "value1" }),
            e => e instanceof Error
            );
    
        expect(handlerA.callCount).to.be.eql(0);
        expect(handlerB.callCount).to.be.eql(0);
        expect(handlerC.callCount).to.be.eql(0);

    });
}

function executionShouldThrowIfZeroHandlers(execution: string) : void 
{
    it(`Should throw if zero supported handlers`, async () => {

        const handlerA = sinon.stub().returns({ a: "x" });
        const handlerB = sinon.stub().returns({ b: "x" });
        const handlerC = sinon.stub().returns({ c: "x" });
        const factories = [
            createHandlerFactory("a", () => false, handlerA),
            createHandlerFactory("b", () => false, handlerB),
            createHandlerFactory("c", () => false, handlerC)
        ];

        await expectToThrowAsync(
            () => executeAsync(execution, factories, "name", { "param1": "value1" }), 
            e => e instanceof Error
            );
    
        expect(handlerA.callCount).to.be.eql(0);
        expect(handlerB.callCount).to.be.eql(0);
        expect(handlerC.callCount).to.be.eql(0);
    });
}

function executionShouldReturnEmptArrayIfZeroHandlers(execution: string) : void 
{
    it(`Should return empty array if zero supported handlers`, async () => {

        const handlerA = sinon.stub().returns({ a: "x" });
        const handlerB = sinon.stub().returns({ b: "x" });
        const handlerC = sinon.stub().returns({ c: "x" });
        const factories = [
            createHandlerFactory("a", () => false, handlerA),
            createHandlerFactory("b", () => false, handlerB),
            createHandlerFactory("c", () => false, handlerC)
        ];

        const result = await executeAsync(execution, factories, "name", { "param1": "value1" });
    
        expect(result).to.be.deep.equal([]);
        expect(handlerA.callCount).to.be.equal(0);
        expect(handlerB.callCount).to.be.equal(0);
        expect(handlerC.callCount).to.be.equal(0);
    });
}

async function expectToThrowAsync(
    fn: () => any, 
    condition?: (e:any) => boolean,
    conditionExplanation?: string
    ) {
    try 
    {
        await Promise.resolve(fn());
        assert.fail("No error was thrown")
    } catch (e) {
        if (condition && !condition(e)) {
            assert.fail(
                "Something was thrown, but did not satisfy condition" + 
                    (conditionExplanation ? `: ${conditionExplanation}` : "")
            );
        }
    }
}

function createHandlerFactory(name: string, canHandle: (requestName: string) => boolean, handler: () => any) : HandlerFactory {
    
    const factory:HandlerFactory = {
        name: name,
        canHandle: canHandle,
        createHandler: function (requestName: string): (requestParameters: object) => object {
            return handler;
        } 
    };

    return factory;
}