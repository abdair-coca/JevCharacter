import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = (name: string) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")) as { version: string; dependencies?: Record<string, string> };

describe("self-hosted Rive runtime", () => {
  // riveRuntime.ts bundles rive.wasm from the hoisted @rive-app/webgl2; it must be the exact
  // version the React package runs, or the JavaScript and the WebAssembly would not match.
  it("bundles the wasm of the same @rive-app/webgl2 version that @rive-app/react-webgl2 pins", () => {
    expect(manifest("@rive-app/webgl2").version).toBe(manifest("@rive-app/react-webgl2").dependencies?.["@rive-app/webgl2"]);
  });
});
