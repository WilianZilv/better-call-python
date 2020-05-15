const Python = require('./lib');
const python = new Python({});

async function main() {
  console.log('return the result of (5 + 3) and log');
  const result = await python.call('5 + 3');
  console.log(result);
}

main();
