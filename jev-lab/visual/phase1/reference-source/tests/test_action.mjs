import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ActionLifecycle, applyActionFrame, hitBody, handleActivationKey, suspendAction } from "../web/action.mjs";

const anatomy = JSON.parse(readFileSync(new URL("../rive/character/body_contract.json", import.meta.url), "utf8"));
const spec = (name) => JSON.parse(readFileSync(new URL(`../specs/${name}.json`, import.meta.url), "utf8"));
const transform = (changes = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...changes });
const neutral = { root: transform({ x: 180, y: 207 }), bodyTransform: transform(), eyes: transform({ y: -9 }), blink: transform() };
const rect = { left: 10, top: 20, width: 720, height: 340 };
const screen = (x, y) => ({ x: 190 + x, y: 20 + y });

test("only body silhouette accepts clicks; halo and rounded corners do not", () => {
  for (const [x, y, expected] of [[180, 207, true], [240, 207, true], [250, 207, false], [240, 263, false], [15, 15, false]]) {
    const point = screen(x, y);
    assert.equal(hitBody(point.x, point.y, rect, anatomy, neutral), expected);
  }
});

test("hit test inverts both transforms and contain offsets", () => {
  const transforms = { ...neutral, root: transform({ x: 180, y: 160, rotation: 0.3, scaleX: 1.1, scaleY: 0.9 }), bodyTransform: transform({ x: 4, y: -2, rotation: -0.1, scaleX: 0.95, scaleY: 1.08 }) };
  const apply = (point, t) => ({ x: t.x + Math.cos(t.rotation) * point.x * t.scaleX - Math.sin(t.rotation) * point.y * t.scaleY, y: t.y + Math.sin(t.rotation) * point.x * t.scaleX + Math.cos(t.rotation) * point.y * t.scaleY });
  for (const [local, expected] of [[{ x: 50, y: 0 }, true], [{ x: 70, y: 0 }, false]]) {
    const point = apply(apply(local, transforms.bodyTransform), transforms.root);
    const client = screen(point.x, point.y);
    assert.equal(hitBody(client.x, client.y, rect, anatomy, transforms), expected);
  }
});

test("busy requests are ignored without queue or timeline restart", () => {
  const lifecycle = new ActionLifecycle();
  assert.equal(lifecycle.request("happy_bounce", spec("happy_bounce").duration, neutral), true);
  lifecycle.tick(0.2);
  assert.equal(lifecycle.request("curious_look", spec("curious_look").duration, neutral), false);
  assert.equal(lifecycle.active.name, "happy_bounce");
  assert.equal(lifecycle.active.elapsed, 0.2);
  assert.equal(lifecycle.acceptedRequests, 1);
  assert.equal(lifecycle.ignoredRequests, 1);
});

test("entry blend occupies original first 80 ms, not extra duration", () => {
  const lifecycle = new ActionLifecycle();
  lifecycle.request("happy_bounce", spec("happy_bounce").duration, neutral);
  assert.equal(lifecycle.tick(0.04).mix, 0.5);
  assert.equal(lifecycle.tick(0.04).mix, 1);
  assert.equal(lifecycle.active.elapsed, 0.08);
  const end = lifecycle.tick(0.67);
  assert.equal(end.owner, "neutral");
  assert.equal(end.completed.elapsed, 0.75);
});

test("curiosity keeps original 800 ms and neutral owner precedes resumed tracking", () => {
  const lifecycle = new ActionLifecycle();
  lifecycle.request("curious_look", spec("curious_look").duration, neutral);
  assert.equal(lifecycle.tick(0.79).owner, "action");
  const end = lifecycle.tick(0.02);
  assert.equal(end.owner, "neutral");
  assert.equal(end.completed.elapsed, 0.8);
  assert.equal(lifecycle.busy, true);
  assert.equal(lifecycle.request("happy_bounce", 0.75, neutral), false);
  assert.deepEqual(lifecycle.tick(1 / 60), { owner: "tracking", resumed: true });
  assert.equal(lifecycle.busy, false);
  assert.deepEqual(lifecycle.tick(1 / 60), { owner: "tracking", resumed: false });
});

test("capture remains immutable and repeated blend never accumulates", () => {
  const lifecycle = new ActionLifecycle();
  const start = structuredClone(neutral); start.eyes.x = 8;
  lifecycle.request("happy_bounce", 0.75, start);
  start.eyes.x = -8;
  const sample = lifecycle.tick(0.04);
  const nodes = structuredClone(neutral);
  const instance = { apply(mix) { nodes.eyes.x += (2 - nodes.eyes.x) * mix; } };
  applyActionFrame(nodes, neutral, sample.action, sample.mix, instance);
  assert.equal(nodes.eyes.x, 5);
  applyActionFrame(nodes, neutral, sample.action, sample.mix, instance);
  assert.equal(nodes.eyes.x, 5);
  const full = lifecycle.tick(0.04);
  applyActionFrame(nodes, neutral, full.action, full.mix, instance);
  assert.equal(nodes.eyes.x, 2);
});

test("cancellation releases ownership without deferred reaction", () => {
  const lifecycle = new ActionLifecycle();
  lifecycle.request("happy_bounce", 0.75, neutral);
  lifecycle.tick(0.2);
  lifecycle.cancel();
  assert.equal(lifecycle.busy, false);
  assert.deepEqual(lifecycle.tick(0.1), { owner: "tracking", resumed: false });
});

test("invalid action, time and inverse transforms fail closed", () => {
  const lifecycle = new ActionLifecycle();
  assert.throws(() => lifecycle.request("unknown", 0.75, neutral));
  assert.throws(() => lifecycle.tick(NaN));
  assert.throws(() => hitBody(0, 0, rect, anatomy, { ...neutral, root: transform({ scaleX: 0 }) }));
});

test("keyboard activation requires focus; Space prevents scrolling; repeats never restart", () => {
  const lifecycle = new ActionLifecycle();
  let prevented = 0;
  const activate = () => lifecycle.request("happy_bounce", 0.75, neutral);
  const event = (key, repeat = false) => ({ key, repeat, preventDefault() { prevented += 1; } });
  assert.equal(handleActivationKey(event("Enter"), false, activate), false);
  assert.equal(handleActivationKey(event("ArrowRight"), true, activate), false);
  assert.equal(prevented, 0);
  assert.equal(handleActivationKey(event(" "), true, activate), true);
  assert.equal(prevented, 1);
  lifecycle.tick(0.2);
  handleActivationKey(event(" ", true), true, activate);
  assert.equal(lifecycle.acceptedRequests, 1);
  assert.equal(lifecycle.ignoredRequests, 0);
  assert.equal(lifecycle.active.elapsed, 0.2);
  handleActivationKey(event("Enter"), true, activate);
  assert.equal(lifecycle.ignoredRequests, 1);
  lifecycle.tick(0.55);
  lifecycle.tick(0.01);
  handleActivationKey(event(" ", true), true, activate);
  assert.equal(lifecycle.busy, false);
  assert.equal(lifecycle.acceptedRequests, 1);
  handleActivationKey(event("Enter"), true, activate);
  assert.equal(lifecycle.acceptedRequests, 2);
});

test("suspension deletes active instance, resets every field and leaves no deferred reaction", () => {
  const lifecycle = new ActionLifecycle();
  lifecycle.request("curious_look", 0.8, neutral);
  lifecycle.tick(0.35);
  const nodes = structuredClone(neutral);
  for (const values of Object.values(nodes)) for (const property of Object.keys(values)) values[property] += 0.3;
  let deletions = 0;
  assert.equal(suspendAction(lifecycle, { delete() { deletions += 1; } }, nodes, neutral), true);
  assert.equal(deletions, 1);
  assert.deepEqual(nodes, neutral);
  assert.equal(lifecycle.busy, false);
  assert.deepEqual(lifecycle.tick(30), { owner: "tracking", resumed: false });
  assert.equal(lifecycle.acceptedRequests, 1);
  assert.equal(suspendAction(lifecycle, null, nodes, neutral), false);
  assert.equal(deletions, 1);
});

test("suspension also clears the final-neutral latch before new interaction", () => {
  const lifecycle = new ActionLifecycle();
  lifecycle.request("happy_bounce", 0.75, neutral);
  lifecycle.tick(0.75);
  assert.equal(lifecycle.neutralFrame, true);
  assert.equal(suspendAction(lifecycle, null, structuredClone(neutral), neutral), true);
  assert.equal(lifecycle.neutralFrame, false);
  assert.equal(lifecycle.request("curious_look", 0.8, neutral), true);
  assert.equal(lifecycle.active.elapsed, 0);
});

test("silhouette hit remains correct after narrow and wide CSS resize, independent of DPR", () => {
  for (const size of [{ width: 296, height: 640 }, { width: 960, height: 280 }]) {
    const bounds = { left: 31, top: 17, ...size };
    const scale = Math.min(size.width / 360, size.height / 340);
    const client = (x, y) => ({ x: bounds.left + (size.width - 360 * scale) / 2 + x * scale, y: bounds.top + (size.height - 340 * scale) / 2 + y * scale });
    const inside = client(180, 207), halo = client(250, 207);
    // El hit test recibe coordenadas CSS; no necesita dimensiones físicas ni DPR.
    assert.equal(hitBody(inside.x, inside.y, bounds, anatomy, neutral), true);
    assert.equal(hitBody(halo.x, halo.y, bounds, anatomy, neutral), false);
  }
});
