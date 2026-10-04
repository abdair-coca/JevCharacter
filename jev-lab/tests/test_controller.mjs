import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSettings, neutralPose, mapContain, pointerTarget, approachPose, settlePose } from "../web/controller.mjs";

const anatomy = JSON.parse(readFileSync(new URL("../rive/character/body_contract.json", import.meta.url), "utf8"));
const settings = JSON.parse(readFileSync(new URL("../web/follow.json", import.meta.url), "utf8"));
const rect = { left: 10, top: 20, width: 720, height: 340 };

test("settings stay inside the existing anatomy contract", () => {
  validateSettings(settings, anatomy);
  assert.throws(() => validateSettings({ ...settings, eyeRange: { x: 9, y: 5 } }, anatomy));
  assert.throws(() => validateSettings({ ...settings, rotationDegrees: 3 }, anatomy));
});

test("contain maps centered horizontal and vertical letterboxing", () => {
  assert.deepEqual(mapContain(190, 20, rect, anatomy.artboard), { x: 0, y: 0 });
  assert.deepEqual(mapContain(550, 360, rect, anatomy.artboard), { x: 360, y: 340 });
  assert.deepEqual(mapContain(0, 190, { left: 0, top: 0, width: 360, height: 720 }, anatomy.artboard), { x: 0, y: 0 });
});

test("character center stays neutral after resize with no DPR input", () => {
  for (const size of [{ width: 360, height: 340 }, { width: 720, height: 340 }, { width: 360, height: 720 }]) {
    const scale = Math.min(size.width / 360, size.height / 340);
    const x = (size.width - 360 * scale) / 2 + 180 * scale;
    const y = (size.height - 340 * scale) / 2 + 207 * scale;
    assert.deepEqual(pointerTarget(x, y, { left: 0, top: 0, ...size }, anatomy, settings), neutralPose(anatomy));
  }
});

test("far cursor positions clamp exactly to eye and body bounds", () => {
  for (const sign of [-1, 1]) {
    const target = pointerTarget(sign * 1e6, sign * 1e6, rect, anatomy, settings);
    assert.equal(target.eyeX, sign * 8);
    assert.equal(target.eyeY, -9 + sign * 5);
    assert.equal(target.rotation, sign * 2 * Math.PI / 180);
  }
});

test("exponential response agrees at 30, 60 and 144 fps", () => {
  const target = { eyeX: 8, eyeY: -4, rotation: 2 * Math.PI / 180 };
  const results = [30, 60, 144].map((fps) => {
    let pose = neutralPose(anatomy);
    for (let frame = 0; frame < fps; frame++) pose = approachPose(pose, target, 1 / fps, settings);
    return pose;
  });
  for (const result of results.slice(1)) {
    for (const property of Object.keys(result)) assert.ok(Math.abs(result[property] - results[0][property]) < 1e-12);
  }
});

test("eye response leads body response without overshoot", () => {
  const target = { eyeX: 8, eyeY: -4, rotation: 2 * Math.PI / 180 };
  const pose = approachPose(neutralPose(anatomy), target, 0.07, settings);
  assert.ok(pose.eyeX / 8 > pose.rotation / target.rotation);
  assert.ok(pose.eyeX > 0 && pose.eyeX < 8 && pose.rotation > 0 && pose.rotation < target.rotation);
});

test("pointer leave settles to exact neutral so scheduling can stop", () => {
  let pose = { eyeX: 8, eyeY: -4, rotation: 2 * Math.PI / 180 };
  const neutral = neutralPose(anatomy);
  let settled = false;
  for (let frame = 0; frame < 180 && !settled; frame++) {
    const result = settlePose(approachPose(pose, neutral, 1 / 60, settings), neutral, settings);
    pose = result.pose; settled = result.settled;
  }
  assert.equal(settled, true);
  assert.deepEqual(pose, neutral);
  assert.deepEqual(settlePose(pose, neutral, settings), { pose: neutral, settled: true });
});

test("invalid coordinates and elapsed time fail closed", () => {
  assert.throws(() => mapContain(NaN, 0, rect, anatomy.artboard));
  assert.throws(() => mapContain(0, 0, { ...rect, width: 0 }, anatomy.artboard));
  assert.throws(() => approachPose(neutralPose(anatomy), neutralPose(anatomy), -1, settings));
});
