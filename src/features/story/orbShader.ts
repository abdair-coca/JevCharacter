/** One oversized triangle covers the canvas; no vertex buffers. */
export const ORB_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Size units (centered, y down). Behind: the scene image in its own colors, faded into
 * the stage. Above: a clear soap-bubble orb that only lenses what is behind it, with a
 * little dispersion and a Siri-colored iridescent film at the rim plus a soft gloss.
 * While the orb opens around Jev its center empties into a ring. Premultiplied alpha.
 */
export const ORB_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_extent;
uniform vec4 u_orb;
uniform vec2 u_stretch;
uniform float u_ring;
uniform float u_time;
uniform float u_surge;
uniform float u_mix;
uniform vec2 u_has;
uniform float u_imageScale;
uniform float u_lens;
uniform float u_dispersion;
uniform sampler2D u_imageA;
uniform sampler2D u_imageB;
uniform vec3 u_pink;
uniform vec3 u_blue;
uniform vec3 u_cyan;
uniform vec3 u_violet;
out vec4 color;

vec4 picture(sampler2D image, float has, vec2 p) {
  vec2 uv = p / u_imageScale + 0.5;
  if (has < 0.5 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  // A soft rounded fade and a key on near-black backdrops melt the picture into the stage.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.12), uv) * smoothstep(vec2(0.0), vec2(0.12), 1.0 - uv);
  vec4 s = texture(image, uv);
  return s * edge.x * edge.y * smoothstep(0.02, 0.1, max(max(s.r, s.g), s.b));
}

vec4 stage(vec2 p) {
  return mix(picture(u_imageA, u_has.x, p), picture(u_imageB, u_has.y, p), u_mix);
}

float glowAt(vec2 w, vec2 center, float tightness) {
  vec2 d = w - center;
  return exp(-tightness * dot(d, d));
}

/** sin(n·θ + phase) for the angle θ of a unit direction, for n = 1, 3 or 5. */
float wave(vec2 dir, float n, float phase) {
  float c = dir.x; float s = dir.y;
  vec2 harmonic = n < 2.0 ? vec2(c, s)
    : n < 4.0 ? vec2(4.0 * c * c * c - 3.0 * c, 3.0 * s - 4.0 * s * s * s)
    : vec2(c * (16.0 * c * c * c * c - 20.0 * c * c + 5.0), s * (16.0 * s * s * s * s - 20.0 * s * s + 5.0));
  return harmonic.y * cos(phase) + harmonic.x * sin(phase);
}

void main() {
  vec2 p = (gl_FragCoord.xy / u_resolution - 0.5) * u_extent * vec2(1.0, -1.0);
  vec4 back = stage(p);
  vec2 d = p - u_orb.xy;
  // Moving fast squashes the orb along its velocity, like a drop of liquid.
  float speed = length(u_stretch);
  vec2 along = speed > 1e-4 ? u_stretch / speed : vec2(1.0, 0.0);
  vec2 local = vec2(dot(d, along) / (1.0 + speed), dot(d, vec2(-along.y, along.x)) * (1.0 + speed * 0.5));
  // Angles come from the fixed-frame direction, not atan: no seam at ±π and no jump
  // when the velocity frame flips.
  vec2 dir = d / max(length(d), 1e-6);
  float wobble = 1.0 + (0.022 * wave(dir, 3.0, u_time * 1.1) + 0.016 * wave(dir, 5.0, -u_time * 1.7)) * (1.0 + u_surge * 2.0) * (1.0 - u_ring * 0.6);
  vec2 q = local / (u_orb.z * wobble);
  float rho = length(q);
  float aa = fwidth(rho) * 1.2;
  float body = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rho);
  float turn = u_time * 0.314;
  vec3 iris = mix(mix(u_pink, u_blue, 0.5 + 0.5 * wave(dir, 1.0, turn)), mix(u_cyan, u_violet, 0.5 + 0.5 * wave(dir, 1.0, -turn)), 0.5 + 0.5 * wave(dir, 1.0, turn + 2.1));
  float halo = exp(-max(rho - 1.0, 0.0) * 7.0) * (1.0 - body) * step(1.0, rho) * 0.16 * u_orb.w;
  if (body <= 0.0) { color = back + vec4(iris * halo, halo); return; }
  float z = sqrt(max(1.0 - rho * rho, 0.0));
  // A sphere lens: the center magnifies, the rim compresses and splits the colors.
  float k = 1.0 - u_lens * z;
  float spread = u_dispersion * (1.0 - z);
  vec4 seen = vec4(stage(u_orb.xy + d * k * (1.0 + spread)).r, stage(u_orb.xy + d * k).g, stage(u_orb.xy + d * k * (1.0 - spread)).b, stage(u_orb.xy + d * k).a);
  // Clear film: color only where the bubble is seen edge-on, drifting like a soap film.
  float swirl = 0.5 + 0.5 * sin(q.x * 2.3 + q.y * 1.7 + u_time * 0.4 + sin(q.y * 4.0 + u_time) * 0.6);
  vec3 film = iris * pow(1.0 - z, 3.0) * 0.9 + mix(u_cyan, u_pink, swirl) * pow(1.0 - z, 1.8) * 0.14;
  // A soft gloss up and to the left plus a crisp specular point.
  float sheen = glowAt(q * vec2(1.0, 1.35), vec2(-0.32, -0.57), 9.0) * 0.22
    + pow(max(dot(vec3(q, z), normalize(vec3(-0.45, -0.6, 0.66))), 0.0), 60.0) * 0.6;
  vec3 light = (film + vec3(sheen)) * u_orb.w;
  vec4 glass = vec4(seen.rgb + light, min(1.0, seen.a + max(max(light.r, light.g), light.b)));
  // Inside, only what the lens sees; opening around Jev empties the center into a band.
  float hollow = smoothstep(u_ring * 0.9 - aa, u_ring * 0.9 + aa, rho) * u_ring + (1.0 - u_ring);
  color = mix(back, glass, body * hollow) + vec4(iris * halo, halo);
}`;
