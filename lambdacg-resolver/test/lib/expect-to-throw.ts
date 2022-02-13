import { assert } from "chai";

async function expectToThrowAsync(
    fn: () => Promise<unknown>,
    condition?: (e: unknown) => boolean,
    conditionExplanation?: string
) {
    let hasThrown = false;
    try {
        await Promise.resolve(fn());
    } catch (e) {
        if (condition && !condition(e)) {
            assert.fail(
                "Something was thrown, but did not satisfy condition" +
                    (conditionExplanation ? `: ${conditionExplanation}` : "")
            );
        }
        hasThrown = true;
    }
    if (!hasThrown) {
        assert.fail("No error was thrown");
    }
}

function expectToThrow(
    fn: () => unknown,
    condition?: (e: unknown) => boolean,
    conditionExplanation?: string
) {
    let hasThrown = false;
    try {
        fn();
    } catch (e) {
        if (condition && !condition(e)) {
            assert.fail(
                "Something was thrown, but did not satisfy condition" +
                    (conditionExplanation ? `: ${conditionExplanation}` : "")
            );
        }
        hasThrown = true;
    }
    if (!hasThrown) {
        assert.fail("No error was thrown");
    }
}

export { expectToThrow, expectToThrowAsync };
