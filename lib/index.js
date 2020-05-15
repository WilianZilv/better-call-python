const { spawn } = require('cross-spawn');
const { EventEmitter } = require('events');
const pkill = require('tree-kill');
const path = require('path');
const fs = require('fs');

function assemble(filePath, imports = []) {
  let [begin, end] = String(
    fs.readFileSync(path.join(__dirname, 'driver.py'))
  ).split("''''''");

  let _imports = '';
  for (const _import of imports) {
    if (_import.includes(' from ')) {
      let [modules, package] = _import.split('from');
      _imports += `from ${package.trim()} import ${modules.trim()}\n`;
    } else {
      _imports += 'import ' + _import + '\n';
    }
  }
  let original = '';
  try {
    original = String(fs.readFileSync(filePath));
  } catch (error) {}

  const script = _imports + begin + original + end;

  const dest = path.join(__dirname, 'tmp.py');

  fs.writeFileSync(dest, script);

  return '"' + dest + '"';
}
function send(message, worker) {
  message = JSON.stringify(message);
  worker.stdin.cork();
  worker.stdin.write(message + '\n');
  worker.stdin.uncork();
}
function enqueue(message, instance) {
  return new Promise((resolve, reject) => {
    instance.promises.push({ message, resolve, reject });
    if (instance.promises.length === 1) send(message, instance.worker);
  });
}

class Python extends EventEmitter {
  promises = [];
  constructor(options = {}) {
    super();
    const { filePath, interpreter, reviveOnCrash, imports } = options;
    this.imports = imports || [];
    this.reviveOnCrash = reviveOnCrash || false;
    this.interpreter = interpreter || 'python';
    this.filePath = filePath;
    process.on('exit', () => this.quit());
    this.enable();
  }
  enable() {
    const worker = spawn(
      this.interpreter,
      [assemble(this.filePath, this.imports)],
      {
        cwd: path.dirname(this.filePath || __dirname),
        shell: true,
      }
    );
    this.worker = worker;

    const handleError = (a) => {
      this.restartTimeout = setTimeout(() => {
        this.enable();
      }, 5000);
    };
    worker.stderr.on('data', (buffer) => {
      const { channel, args } = JSON.parse(buffer);
      if (channel === 'print') {
        console.log(...args);
      } else {
        this.emit(channel, ...args);
      }
    });
    worker.on('exit', handleError);
    worker.on('SIGTERM', handleError);
    worker.on('error', handleError);

    worker.stdout.on('data', (response) => {
      const promise = this.promises.shift();
      if (!promise) return;

      const { resolve, reject } = promise;

      try {
        const { data, error } = JSON.parse(String(response));
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }

        if (this.promises.length) send(this.promises[0].message, this.worker);
      } catch (error) {
        console.log('Error:', error);
        console.log('Response:', String(response));
        reject({ error, response: String(response) });
      }
    });
  }
  quit() {
    if (this.worker) {
      this.worker.removeAllListeners();
      this.worker.on('exit', NOOP);
      this.worker.on('SIGTERM', NOOP);
      this.worker.on('error', NOOP);

      pkill(this.worker.pid);
      try {
        fs.unlinkSync(path.join(__dirname, 'tmp.py'));
      } catch (error) {}
    }
  }

  call(path, ...args) {
    if (args.length) path += '(*args)';
    return enqueue({ path, args }, this);
  }
}
module.exports = Python;
