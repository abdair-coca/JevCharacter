/** One oversized triangle covers the canvas; no vertex buffers. */
export const ORB_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Size units (centered, y down). Behind: the scene image in its own colors, faded into
 * the stage. Above: a glass orb that lenses it with a little dispersion at the rim and
 * carries ribbons of Siri-like light, a soft gloss and an iridescent edge. While the
 * orb opens around Jev its center empties into a ring. Output is premultiplied alpha.
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
uniform float u_glow;
uniform float u_imageScale;
uniform float u_lens;
uniform float u_dispersion;
uniform sampler2D u_imageA;
uniform sampler2D u_imageB;
uniform vec3 u_base;
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

vec3 ribbons(vec2 q) {
  // Domain-warped flow: four colored lights drift and fold through each other.
  vec2 w = q + 0.18 * vec2(sin(q.y * 3.1 + u_time * 0.9), sin(q.x * 2.7 - u_time * 0.7));
  float t = u_time * 0.55;
  return u_pink * glowAt(w, 0.42 * vec2(sin(t * 1.1), cos(t * 0.9)), 4.0)
    + u_blue * glowAt(w, 0.45 * vec2(cos(t * 0.8 + 2.0), sin(t * 1.3 + 1.0)), 4.0)
    + u_cyan * glowAt(w, 0.4 * vec2(sin(t * 1.4 + 4.0), cos(t * 0.7 + 3.0)), 5.0)
    + u_violet * glowAt(w, 0.3 * vec2(cos(t * 0.6 + 5.0), sin(t * 0.9 + 2.0)), 3.0);
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
  vec3 iris = mix(mix(u_pink, u_blue, 0.5 + 0.5 * wave(dir, 1.0, turn)), u_cyan, 0.5 + 0.5 * wave(dir, 1.0, turn + 2.1));
  float halo = exp(-max(rho - 1.0, 0.0) * 7.0) * (1.0 - body) * step(1.0, rho) * 0.28 * u_orb.w;
  if (body <= 0.0) { color = back + vec4(iris * halo, halo); return; }
  float z = sqrt(max(1.0 - rho * rho, 0.0));
  // A sphere lens: the center magnifies, the rim compresses and splits the colors.
  float k = 1.0 - u_lens * z;
  float spread = u_dispersion * (1.0 - z);
  vec4 seen = vec4(stage(u_orb.xy + d * k * (1.0 + spread)).r, stage(u_orb.xy + d * k).g, stage(u_orb.xy + d * k * (1.0 - spread)).b, stage(u_orb.xy + d * k).a);
  vec4 under = seen + vec4(u_base, 1.0) * 0.82 * u_glow * (1.0 - seen.a);
  // Over a picture the glass stays mostly clear; a soft curve keeps overlapping lights from clipping.
  vec3 light = ribbons(q) * (0.1 + 0.9 * u_glow * u_glow) * (0.55 + 0.45 * z);
  light = light / (1.0 + light * 0.7);
  float rim = pow(1.0 - z, 3.0);
  // A soft gloss up and to the left plus a crisp specular point.
  float sheen = glowAt(q * vec2(1.0, 1.35), vec2(-0.32, -0.57), 9.0) * 0.38
    + pow(max(dot(vec3(q, z), normalize(vec3(-0.45, -0.6, 0.66))), 0.0), 60.0) * 0.6;
  vec3 lit = under.rgb + light + iris * rim * 0.9 + vec3(sheen);
  float alpha = max(under.a, clamp(max(max(light.r, light.g), light.b) + rim + sheen, 0.0, 1.0));
  // Opening around Jev: the center empties and a band of light remains.
  float hollow = smoothstep(u_ring * 0.9 - aa, u_ring * 0.9 + aa, rho) * u_ring + (1.0 - u_ring);
  vec4 orb = vec4(lit, alpha) * body * hollow * u_orb.w;
  color = orb + back * (1.0 - orb.a) + vec4(iris * halo, halo);
}`;
