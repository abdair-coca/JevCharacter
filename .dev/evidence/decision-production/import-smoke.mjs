import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

for (const name of ["decide", "talk"]) {
  const { default: handler } = await import(pathToFileURL(resolve(`node_modules/.tmp/jev-node-runtime/api/${name}.js`)).href);
  let status;
  const response = {
    setHeader() {},
    status(code) { status = code; return response; },
    json(value) { return value; },
  };
  await handler({ method: "GET", headers: {}, socket: {} }, response);
  assert.equal(status, 405);
  console.log(`PASS: emitted ${name} ESM handler imports and runs in Node`);
}
