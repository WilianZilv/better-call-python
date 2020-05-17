const { spawn } = require("cross-spawn");
const { EventEmitter } = require("events");
const pkill = require("tree-kill");
const path = require("path");
const pack = require("./pack");
const NOOP = () => {};

function send(message, worker) {
    worker.stdin.write(JSON.stringify(message) + "\n");
}
function enqueue(message, instance) {
    return new Promise((resolve, reject) => {
        instance.queue.push({ message, resolve, reject });
        if (instance.queue.length === 1) send(message, instance.worker);
    });
}

class Python extends EventEmitter {
    queue = [];
    /**
     * @fires crash in case restartOnCrash is false.
     *
     * @param {Object} options Options.
     * @param {String} [options.filePath] Location of your script. (Optional)
     * @param {String} [options.interpreter=python] Python interpreter. Default: "python"
     * @param {Boolean} [options.restartOnCrash=false] Kills Python process and start a new one after crashing.
     * @param {Number} [options.restartDelay=500] Restart delay after crash.
     * @param {Array<String>} [options.imports=[]] Example: ["pow, factorial from math", "time from time"] or ["math", "time"].
     */
    constructor(options = {}) {
        super();
        this.imports = options.imports || [];
        this.restartOnCrash = options.restartOnCrash || false;
        this.restartDelay = options.restartDelay || 500;
        this.interpreter = options.interpreter || "python";
        this.filePath = options.filePath;
        process.on("exit", () => this.quit());
        this.run();
    }
    run() {
        const script = pack(this.filePath, this.imports);
        const worker = spawn(
            this.interpreter,
            ["-c", script],

            {
                cwd: this.filePath
                    ? path.dirname(this.filePath)
                    : process.cwd(),
            }
        );
        this.worker = worker;
        const handleError = (code) => {
            if (!this.restartOnCrash) return this.emit("crash", code);
            this.restartTimeout = setTimeout(() => {
                this.run();
            }, this.restartDelay);
        };
        worker.stderr.on("data", (buffer) => {
            try {
                const { channel, args } = JSON.parse(buffer);
                if (channel === "print") console.log(...args);
                else this.emit(channel, ...args);
            } catch (error) {
                console.error("error", String(buffer));
            }
        });
        worker.on("exit", handleError);
        worker.on("SIGTERM", handleError);
        worker.on("error", handleError);

        worker.stdout.on("data", (response) => {
            const promise = this.queue.shift();
            if (!promise) return;

            const { resolve, reject } = promise;

            try {
                const { data, error } = JSON.parse(String(response));
                if (error) reject(error);
                else resolve(data);

                if (this.queue.length) send(this.queue[0].message, this.worker);
            } catch (error) {
                console.log("Error:", error);
                console.log("Response:", String(response));
                reject({ error, response: String(response) });
            }
        });
    }
    quit() {
        if (!this.worker) return;
        this.worker.removeAllListeners();
        this.worker.on("exit", NOOP);
        this.worker.on("SIGTERM", NOOP);
        this.worker.on("error", NOOP);
        pkill(this.worker.pid);
    }
    /**
     * @param {String}  path    variable or function.
     * @param {Array}   args    Function parameters, in case your function have one or more.
     * @example call("math.pow", 5, 3)
     *          call("increase_number")
     *          call("increase_number", { amount: 5 })
     */
    call(path, ...args) {
        if (args.length) if (typeof args[0] === "object") args = args[0];
        return enqueue({ path, args }, this);
    }
}
module.exports = Python;
