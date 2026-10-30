import { DROPLETS, RIPPLES } from "./waterPhysics";

/** One oversized triangle covers the canvas; no vertex buffers. */
export const ORB_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Size units (centered, y down). Behind: the scene image in its own colors, faded into
 * the stage. Above: a drop of clear water, a smooth union of the body and its droplets,
 * flat on top and rounded at the edge. It bends what is behind it, darkens where light
 * reflects inside, mirrors a soft window, glints, focuses a caustic on its far side and
 * casts a soft shadow. Music-driven ripples cross it. Premultiplied alpha.
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
uniform float u_refraction;
uniform float u_dispersion;
uniform float u_height;
uniform float u_pulse;
uniform vec4 u_modes;
uniform vec3 u_drops[${DROPLETS}];
uniform vec4 u_ripples[${RIPPLES}];
uniform sampler2D u_imageA;
uniform sampler2D u_imageB;
out vec4 color;

const vec3 LIGHT = vec3(-0.45, -0.6, 0.66);

vec4 picture(sampler2D image, float has, vec2 p) {
  vec2 uv = p / u_imageScale + 0.5;
  if (has < 0.5 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  // A soft rounded fade and a key on near-black backdrops melt the picture into the stage.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.12), uv) * smoothstep(vec2(0.0), vec2(0.12), 1.0 - uv);
  vec4 s = texture(image, uv);
  return s * edge.x * edge.y * smoothstep(0.02, 0.1, max(max(s.r, s.g), s.b));
}

vec4 stage(vec2 p) {
  vec4 image = mix(picture(u_imageA, u_has.x, p), picture(u_imageB, u_has.y, p), u_mix);
  // With no picture, a faint studio light behind the drop gives the water something to bend.
  float bare = 1.0 - mix(u_has.x, u_has.y, u_mix);
  float glow = (0.09 * exp(-dot(p, p) * 5.0) + 0.025 * smoothstep(0.2, 1.0, sin((p.x + p.y) * 14.0))) * exp(-dot(p, p) * 3.0) * bare;
  return image + vec4(vec3(0.62, 0.58, 0.9) * glow, glow) * (1.0 - image.a);
}

/** cos and sin of n·θ for a unit direction, n = 2 or 3; no atan, so no seam at ±π. */
vec2 harmonic2(vec2 d) { return vec2(d.x * d.x - d.y * d.y, 2.0 * d.x * d.y); }
vec2 harmonic3(vec2 d) { return vec2(d.x * (4.0 * d.x * d.x - 3.0), d.y * (3.0 - 4.0 * d.y * d.y)); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

/** Signed distance to the water: negative inside. */
float water(vec2 p) {
  vec2 d = p - u_orb.xy;
  // Moving fast squashes the drop along its velocity.
  float speed = length(u_stretch);
  vec2 along = speed > 1e-4 ? u_stretch / speed : vec2(1.0, 0.0);
  vec2 local = vec2(dot(d, along) / (1.0 + speed), dot(d, vec2(-along.y, along.x)) * (1.0 + speed * 0.5));
  float reach = length(local);
  vec2 dir = d / max(length(d), 1e-6);
  // Surface tension: a breathing pulse, a sloshing squash and three-lobed ripples, plus a slow drift.
  float idle = 0.012 * sin(dot(dir, vec2(2.1, 1.3)) * 3.0 + u_time * 0.9) * (1.0 + u_surge * 2.0);
  float shape = u_orb.z * (1.0 + u_pulse + dot(harmonic2(dir), u_modes.xy) + dot(harmonic3(dir), u_modes.zw) + idle * (1.0 - u_ring * 0.7));
  float body = mix(reach - shape, abs(reach - shape) - u_orb.z * 0.08, u_ring);
  for (int i = 0; i < ${DROPLETS}; i++) body = smin(body, length(p - u_drops[i].xy) - u_drops[i].z, 0.035);
  return body;
}

void main() {
  vec2 p = (gl_FragCoord.xy / u_resolution - 0.5) * u_extent * vec2(1.0, -1.0);
  float sdf = water(p);
  // A soft shadow down and to the right, opposite the light; it only shows over a picture.
  float shadow = sdf < 0.12 ? 1.0 - smoothstep(-0.01, 0.07, water(p - vec2(0.02, 0.028))) : 0.0;
  vec4 back = stage(p);
  back.rgb *= 1.0 - 0.35 * shadow;
  float aa = fwidth(sdf) * 0.8;
  float inside = 1.0 - smoothstep(-aa, aa, sdf);
  if (inside <= 0.0) { color = back; return; }
  float e = 0.0015;
  vec2 gradient = vec2(water(p + vec2(e, 0.0)) - water(p - vec2(e, 0.0)), water(p + vec2(0.0, e)) - water(p - vec2(0.0, e)));
  vec2 inward = -gradient / max(length(gradient), 1e-6);
  // Height of a drop on glass: a quarter-circle edge, flat beyond; a small drop keeps a clear center.
  float depth = max(-sdf, 0.0);
  float u = min(depth / min(u_height, u_orb.z * 0.55), 1.0);
  float rise = sqrt(max(1.0 - (1.0 - u) * (1.0 - u), 1e-4));
  vec2 slope = inward * min((1.0 - u) / rise, 8.0);
  // Ripples: wave packets running out from where each note landed.
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 w = u_ripples[i];
    if (w.w <= 0.0) continue;
    vec2 r = p - w.xy;
    float from = max(length(r), 1e-4);
    float front = w.z * 0.22;
    float packet = exp(-pow((from - front) / 0.035, 2.0)) * exp(-w.z * 1.4) * w.w;
    // Where the note landed the wave has no direction yet: it fades in from there.
    slope += 0.55 * packet * cos((from - front) * 130.0) * r / from * smoothstep(0.0, 0.03, depth) * smoothstep(0.0, 0.012, from);
  }
  vec3 normal = normalize(vec3(-slope, 1.0));
  // Refraction: the flat top barely bends, the rounded edge bends hard and splits a little.
  vec2 bend = normal.xy * u_refraction * (0.4 + u * 0.6);
  vec2 seen = u_orb.xy + (p - u_orb.xy) * (1.0 - 0.08 * u) - bend;
  vec4 center = stage(seen);
  vec4 through = vec4(stage(seen - normal.xy * u_dispersion).r, center.g, stage(seen + normal.xy * u_dispersion).b, center.a);
  // Light reflected inside a steep edge never reaches the eye: a dark band at the rim.
  through.rgb *= mix(0.12, 1.0, smoothstep(0.2, 0.7, normal.z));
  float fresnel = 0.02 + 0.98 * pow(1.0 - normal.z, 5.0);
  vec3 mirrored = reflect(vec3(0.0, 0.0, -1.0), normal);
  float window = smoothstep(0.26, 0.1, length((mirrored.xy - vec2(-0.42, -0.5)) * vec2(1.0, 1.5)));
  float sky = 0.06 + 0.22 * smoothstep(0.6, -0.4, mirrored.y);
  float glint = pow(max(dot(normal, normalize(LIGHT + vec3(0.0, 0.0, 1.0))), 0.0), 220.0) * 1.6;
  // Light focused through the drop: a bright crescent just inside its far edge.
  float far = max(dot(-inward, -normalize(LIGHT.xy)), 0.0);
  float caustic = smoothstep(0.0, 0.015, depth) * smoothstep(0.07, 0.02, depth) * far * far * 0.45;
  vec3 light = (vec3(window * 1.4 + sky) * fresnel + vec3(glint + caustic)) * u_orb.w;
  vec4 drop = vec4(through.rgb * (1.0 - fresnel) + light, max(through.a, min(1.0, max(max(light.r, light.g), light.b))));
  color = mix(back, drop, inside);
}`;
