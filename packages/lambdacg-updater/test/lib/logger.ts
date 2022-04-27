let defaultLogCallback: ((message: string) => void) | undefined = undefined;

const setDefaultLogCallback = (
    callback: ((message: string) => void) | undefined
) => {
    defaultLogCallback = callback;
};

class Logger {
    #callback: ((message: string) => void) | undefined;

    setCallback(callback: ((message: string) => void) | undefined) {
        this.#callback = callback;
    }

    log(message: string) {
        if (this.#callback) {
            this.#callback(message);
        } else if (defaultLogCallback) {
            defaultLogCallback(message);
        }
    }
}

const getLogger = () => new Logger();

export { getLogger, setDefaultLogCallback };
