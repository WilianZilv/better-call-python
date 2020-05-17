const fs = require("fs");
const path = require("path");

const transpileImports = (imports) => {
    let _imports = "";
    for (const _import of imports) {
        if (_import.includes("json") || _import.includes("sys")) continue;

        if (_import.includes(" from ")) {
            let [modules, package] = _import.split("from");
            _imports += `from ${package} import ${modules}\r\n`;
        } else {
            _imports += `import ${_import}\r\n`;
        }
    }
    return _imports;
};
module.exports = (filePath, imports = []) => {
    const driver = String(fs.readFileSync(path.join(__dirname, "driver.py")));
    const script = filePath ? String(fs.readFileSync(filePath)) : "";

    const [dri, ver] = driver.split("''''''");

    imports = transpileImports(imports);

    return imports + dri + script + ver;
};
