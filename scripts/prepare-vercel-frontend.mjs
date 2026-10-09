import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const output = new URL(".vercel/output/", root);

// Verify the build before replacing only generated output, never project linking.
await access(new URL("index.html", dist));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(dist, new URL("static/", output), { recursive: true });
await writeFile(new URL("config.json", output), JSON.stringify({
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: "^/(features|about)/?$", dest: "/index.html" },
  ],
}, null, 2) + "\n");
console.log("Vercel frontend ready: static files only, no functions.");
