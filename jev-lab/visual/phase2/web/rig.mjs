/** Static phase-2 rig sampler. No playback, sequence or ambient scheduler. */
export function validateState(state, contract) {
  const expected = Object.keys(contract.neutral).sort();
  if (!state || Object.keys(state).sort().join() !== expected.join()) throw new Error("Estado incompleto o canal desconocido");
  for (const [key, [low, high]] of Object.entries(contract.ranges)) {
    if (typeof state[key] !== "number" || !Number.isFinite(state[key]) || state[key] < low || state[key] > high) {
      throw new Error(`${key}: fuera de [${low}, ${high}]`);
    }
  }
  for (const key of ["shapeFrom", "shapeTo"]) {
    if (!Object.hasOwn(contract.shapes, state[key])) throw new Error(`${key}: forma desconocida`);
  }
  if (typeof state.morph !== "number" || !Number.isFinite(state.morph) || state.morph < 0 || state.morph > 1) throw new Error("Morph fuera de [0, 1]");
  return state;
}

export function createRigSampler(runtime, artboard, contract) {
  const clips = new Map();
  let disposed = false;
  try {
    for (const name of ["neutral", ...Object.keys(contract.shapes).map(name => `shape_${name}`), ...Object.keys(contract.ranges).map(name => `channel_${name}`)]) {
      const animation = artboard.animationByName(name);
      if (!animation) throw new Error(`Clip ausente: ${name}`);
      clips.set(name, new runtime.LinearAnimationInstance(animation, artboard));
    }
  } catch (error) {
    for (const clip of clips.values()) clip.delete();
    throw error;
  }
  function apply(name, time = 0, mix = 1) {
    const clip = clips.get(name);
    clip.time = time;
    clip.advance(0);
    clip.apply(mix);
  }
  function sample(state) {
    if (disposed) throw new Error("Rig cerrado");
    validateState(state, contract);
    // Reset every keyed property before composition; no retained previous pose.
    apply("neutral");
    apply(`shape_${state.shapeFrom}`);
    apply(`shape_${state.shapeTo}`, 0, state.morph);
    for (const [name, [low, high]] of Object.entries(contract.ranges)) {
      apply(`channel_${name}`, (state[name] - low) / (high - low));
    }
    artboard.advance(0);
    return { ...state };
  }
  return {
    sample,
    neutral() { return sample({ ...contract.neutral }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const clip of clips.values()) clip.delete();
      clips.clear();
    },
  };
}
