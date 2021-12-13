import { assert } from "chai";

async function expectToThrowAsync(
    fn: () => unknown,
    condition?: (e: unknown) => boolean,
    conditionExplanation?: string
) {
    try {
        await Promise.resolve(fn());
        assert.fail("No error was thrown");
    } catch (e) {
        if (condition && !condition(e)) {
            assert.fail(
                "Something was thrown, but did not satisfy condition" +
                    (conditionExplanation ? `: ${conditionExplanation}` : "")
            );
        }
    }
}

export { expectToThrowAsync };
