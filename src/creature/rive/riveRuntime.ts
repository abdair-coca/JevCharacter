import { RuntimeLoader } from "@rive-app/react-webgl2";
// Same package and version that @rive-app/react-webgl2 pins; tests/riveRuntime.test.ts guards the match.
import riveWasmUrl from "@rive-app/webgl2/rive.wasm?url";

// By default the runtime downloads rive.wasm from unpkg on every visit, with no timeout: a slow or
// stalled CDN left Jev stuck on «Preparando a Jev…». Serving it from this site removes that hop.
// The jsdelivr fallback still applies if this file ever fails to load.
RuntimeLoader.setWasmUrl(riveWasmUrl);
