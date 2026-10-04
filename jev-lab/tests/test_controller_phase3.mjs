import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createController } from "../visual/phase3/web/controller.mjs";

const contract = JSON.parse(fs.readFileSync(new URL("../visual/phase2/body_contract.v2.json", import.meta.url)));
const catalog = JSON.parse(fs.readFileSync(new URL("../visual/phase3/catalog.json", import.meta.url)));
function fixture(missing = null) {
  const instances = [], events = [], changes = [];
  let clock = 0, tick, unsubscribed = 0;
  class Instance {
    constructor(animation) { this.name = animation; instances.push(this); this.deleted = 0; }
    advance(delta) { events.push(["advance", this.name, this.time, delta]); }
    apply(mix) { events.push(["apply", this.name, this.time, mix]); }
    delete() { this.deleted++; }
  }
  const board = { animationByName: name => name === missing ? null : name, advance: delta => events.push(["board", delta]) };
  const dependencies = { runtime: { LinearAnimationInstance: Instance }, artboard: board, contract, catalog,
    now: () => clock, subscribe(callback) { tick = callback; return () => { unsubscribed++; }; }, onChange: event => changes.push(event) };
  return { dependencies, events, changes, instances, create: () => createController(dependencies),
    at(value) { clock = value; tick(); }, frame: () => changes.findLast(event => event.type === "frame"),
    get unsubscribed() { return unsubscribed; } };
}

test("real clip sampler ordering, intensity and speed; completion resolves", async () => {
  const f = fixture(), controller = f.create();
  const handle = controller.play("happy_bounce", { speed: 2, intensity: .4 });
  f.events.length = 0; f.at(100);
  const applies = f.events.filter(event => event[0] === "apply");
  assert.equal(applies[0][1], "neutral");
  assert.deepEqual(applies.at(-1), ["apply", "action_happy_bounce__default", .2, .4]);
  assert.deepEqual(f.events.at(-1), ["board", 0]);
  f.at(375);
  assert.deepEqual(await handle.finished, { status: "completed", reason: "completed", completedItems: 1, totalItems: 1 });
  assert.equal(f.frame().neutral, true); controller.dispose();
});

test("invalid new commands leave active playback and composition unchanged", async () => {
  const f = fixture(), controller = f.create();
  const handle = controller.play("curious_look"); f.at(200);
  const previous = f.frame();
  for (const command of [
    () => controller.play("missing"), () => controller.play("curious_look", { speed: 0 }),
    () => controller.play("curious_look", { speed: Infinity }), () => controller.play("curious_look", { speed: null }),
    () => controller.play("curious_look", { intensity: 1.01 }), () => controller.play("curious_look", { intensity: NaN }),
    () => controller.play("curious_look", { intensity: true }), () => controller.play("curious_look", { intensity: null }),
    () => controller.play("curious_look", { variant: "unknown" }), () => controller.play("curious_look", { extra: 1 }),
    () => controller.sequence(["happy_bounce", "missing"]), () => controller.sequence([]),
    () => controller.lookAt(NaN, 0), () => controller.lookAt(9, 0),
    () => controller.setAmbient({ shapeTo: "star" }), () => controller.setAmbient({ blink: 2 }),
  ]) { const count = f.events.length; assert.throws(command); assert.equal(f.events.length, count); assert.equal(f.frame(), previous); }
  f.at(800); assert.equal((await handle.finished).status, "completed"); controller.dispose();
});

test("ownership masks ambient and gaze only on owned channels", () => {
  const f = fixture(), controller = f.create();
  controller.setAmbient({ bodyY: 5, light: .8, leftOpen: .7 }); controller.lookAt(-6, 4);
  controller.play("curious_look"); f.at(100);
  assert.equal(f.frame().baseline.gazeX, 0);
  assert.equal(f.frame().baseline.bodyRotation, 0);
  assert.equal(f.frame().baseline.bodyScaleY, 1);
  assert.equal(f.frame().baseline.gazeY, 4);
  assert.equal(f.frame().baseline.bodyY, 5);
  assert.equal(f.frame().baseline.light, .8);
  assert.equal(f.frame().baseline.leftOpen, .7);
  controller.lookAt(5, -2); controller.setAmbient({ light: .9 });
  assert.equal(f.frame().baseline.gazeX, 0); assert.equal(f.frame().baseline.gazeY, -2);
  f.at(800); assert.equal(f.frame().baseline.gazeX, 5); assert.equal(f.frame().baseline.light, .9);
  controller.stop(); assert.deepEqual(f.frame().baseline, contract.neutral); f.at(1600); assert.equal(f.frame().neutral, true);
  controller.dispose();
});

test("replacement cancels sequence; stale cancellation never kills successor", async () => {
  const f = fixture(), controller = f.create();
  const old = controller.sequence(["happy_bounce", "curious_look"]); f.at(100);
  f.events.length = 0;
  const next = controller.play("attention_pulse", { variant: "full" });
  assert.equal((await old.finished).reason, "replaced");
  assert.equal(f.events[0][1], "neutral");
  assert.deepEqual(f.events.filter(event => event[0] === "apply").at(-1), ["apply", "action_attention_pulse__full", 0, 1]);
  old.cancel(); assert.equal(f.frame().action, "attention_pulse");
  f.at(700); assert.equal((await next.finished).status, "completed"); controller.dispose();
});

test("sequence processes overshoot across multiple items using individual speeds", async () => {
  const f = fixture(), controller = f.create();
  const handle = controller.sequence([{ action: "happy_bounce", speed: 2 }, { action: "curious_look", speed: 4, variant: "left" }, "attention_pulse"]);
  f.at(700);
  assert.equal(f.frame().action, "attention_pulse"); assert.equal(f.frame().elapsedMs, 125);
  assert.deepEqual(f.changes.filter(event => event.type === "itemCompleted").map(event => event.action), ["happy_bounce", "curious_look"]);
  f.at(2000);
  assert.deepEqual(await handle.finished, { status: "completed", reason: "completed", completedItems: 3, totalItems: 3 });
  assert.equal(f.frame().neutral, true); controller.dispose();
});

test("handle cancel, stop, disposal settle explicitly and release resources once", async () => {
  const f = fixture(), controller = f.create();
  const first = controller.play("happy_bounce"); first.cancel(); first.cancel();
  assert.equal((await first.finished).reason, "handle");
  const stopped = controller.sequence(["attention_pulse", "curious_look"]); controller.stop();
  assert.equal((await stopped.finished).reason, "stopped"); assert.equal(f.frame().neutral, true);
  const disposed = controller.play("attention_pulse"); controller.dispose(); controller.dispose();
  assert.equal((await disposed.finished).reason, "disposed"); assert.equal(f.unsubscribed, 1);
  assert.ok(f.instances.every(instance => instance.deleted === 1));
  assert.throws(() => controller.stop(), /disposed/); assert.throws(() => controller.play("happy_bounce"), /disposed/);
  const count = f.events.length; f.at(2000); assert.equal(f.events.length, count);
});

test("zero intensity and inclusive speed bounds remain valid timed requests", async () => {
  const f = fixture(), controller = f.create();
  const zero = controller.play("attention_pulse", { intensity: 0, speed: .1, variant: "soft" }); f.at(3000);
  assert.deepEqual(f.events.filter(event => event[0] === "apply").at(-1), ["apply", "action_attention_pulse__soft", .3, 0]);
  f.at(6000); assert.equal((await zero.finished).status, "completed");
  const fast = controller.play("happy_bounce", { speed: 4 }); f.at(6187.5); assert.equal((await fast.finished).status, "completed");
  controller.dispose();
});

test("missing clips clean partial allocations; lifecycle registers six commands only", () => {
  const f = fixture("action_curious_look__default"); assert.throws(f.create, /Clip absent/);
  assert.ok(f.instances.every(instance => instance.deleted === 1));
  const ready = fixture(), controller = ready.create();
  assert.deepEqual(Object.keys(controller).sort(), ["dispose", "lookAt", "play", "sequence", "setAmbient", "stop"]);
  ready.at(1); assert.throws(() => ready.at(0), /monotonic/); controller.dispose();
});
