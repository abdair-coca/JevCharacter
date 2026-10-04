import test from "node:test";
import assert from "node:assert/strict";
import { bodyTransform, validateComparison } from "../visual/phase1/web/geometry.mjs";
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync(new URL("../visual/phase1/comparison.json", import.meta.url), "utf8"));

test("all body widths match and body centers coincide at both requested sizes", () => {
  validateComparison(config);
  for (const target of Object.values(config.sizes)) {
    for (const version of config.versions) {
      const result = bodyTransform(version.body, target, 300, 220);
      assert.equal(result.scale * version.body.width, target);
      assert.equal(result.scale * version.body.centerX + result.x, 150);
      assert.equal(result.scale * version.body.centerY + result.y, 110);
      assert.ok(Math.abs(result.scale * version.body.height / target - version.body.height / version.body.width) < 1e-12);
    }
  }
});

test("malformed calibration fails before rendering", () => {
  const bad = structuredClone(config); bad.versions[0].body.width = 0;
  assert.throws(() => validateComparison(bad), /Calibración/);
  const nonfinite = structuredClone(config); nonfinite.sizes.small = NaN;
  assert.throws(() => validateComparison(nonfinite), /Tamaño/);
});
