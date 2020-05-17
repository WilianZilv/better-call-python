const Python = require("../lib");
const path = require("path");

(async function () {
    console.log("Example 1");
    let python = new Python();

    console.log("5 + 3 =", await python.call("5 + 3"));
    console.log("abs(-5) ===", await python.call("abs", -5));
    python.quit();

    console.log("\nExample 2: (extra imports)");

    python = new Python({
        imports: ["pow, factorial from math", "pip"],
    });

    console.log("pow(2, 4) ===", await python.call("pow", 2, 4));
    console.log("factorial(16) ===", await python.call("factorial", 16));
    console.log("pip version", await python.call("pip.__version__"));
    python.quit();

    console.log("\nExample 3: (loading a file & emitting events)");

    python = new Python({ filePath: path.join(__dirname, "example1.py") });

    python.on("bigNumber", (number, message) => {
        console.log("number:", number, "message", message);
    });
    console.time("time");

    await python.call("sum_number");
    await python.call("sum_number", { amount: 99 });
    console.log("number === ", await python.call("number"));
    console.timeEnd("time");
    python.quit();
});

const python = new Python();
