import { LIQUID_BALLS } from "./liquidGeometry";

/** One oversized triangle covers the canvas; no vertex buffers. */
export const LIQUID_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Metaball field in size units (centered, y down). Inside the surface the liquid shows a
 * swirling nebula or the scene image, recolored and refracted near the edge; the pointer
 * subtracts a ball (the dent) and adds ripples. Output is premultiplied alpha.
 */
export const LIQUID_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_extent;
uniform vec3 u_balls[${LIQUID_BALLS}];
uniform vec4 u_dent;
uniform vec2 u_center;
uniform float u_time;
uniform float u_surge;
uniform float u_mix;
uniform vec2 u_has;
uniform float u_opacity;
uniform float u_imageScale;
uniform float u_refraction;
uniform float u_ripple;
uniform float u_contrast;
uniform sampler2D u_imageA;
uniform sampler2D u_imageB;
uniform vec3 u_deep;
uniform vec3 u_violet;
uniform vec3 u_pink;
uniform vec3 u_white;
out vec4 color;

vec3 nebula(vec2 p) {
  float r = length(p);
  float arms = 0.5 + 0.5 * sin((atan(p.y, p.x) + u_time * 0.15 + r * 5.0) * 3.0 + sin(r * 14.0 - u_time * 0.6) * 1.2);
  // The arms fade into a calm core instead of pinching at the center.
  arms = mix(0.5, arms, smoothstep(0.0, 0.15, r));
  float flow = 0.5 + 0.5 * sin(p.x * 9.0 + u_time * 0.4 + sin(p.y * 7.0 - u_time * 0.3) * 1.5);
  vec3 c = mix(u_deep, u_violet, arms * 0.75);
  c = mix(c, u_pink, arms * flow * 0.45);
  return c + u_white * pow(arms * flow, 6.0) * 0.5;
}

vec3 scene(sampler2D image, float has, vec2 p, vec3 fill) {
  vec2 uv = p / u_imageScale + 0.5;
  if (has < 0.5 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return fill;
  vec4 s = texture(image, uv);
  float l = pow(dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)), u_contrast);
  // Reinterpreted with the stage palette: shadows sink into the liquid, highlights glow.
  vec3 c = mix(u_deep, u_violet, smoothstep(0.02, 0.45, l));
  c = mix(c, u_pink, smoothstep(0.35, 0.6, l) * 0.4);
  c = mix(c, u_white, smoothstep(0.55, 0.95, l));
  return mix(fill, c, s.a * smoothstep(0.04, 0.2, l));
}

void main() {
  vec2 p = (gl_FragCoord.xy / u_resolution - 0.5) * u_extent * vec2(1.0, -1.0);
  // A slow viscous wobble of the whole surface, stronger while the scene changes.
  p += vec2(sin(p.y * 9.0 + u_time * 1.3), cos(p.x * 8.0 - u_time * 1.1)) * 0.008 * (1.0 + u_surge * 2.0);
  float field = 0.0; vec2 gradient = vec2(0.0);
  for (int i = 0; i < ${LIQUID_BALLS}; i++) {
    vec2 d = p - u_balls[i].xy;
    float r2 = u_balls[i].z * u_balls[i].z;
    float d2 = max(dot(d, d), 1e-5);
    field += r2 / d2;
    gradient -= 2.0 * r2 * d / (d2 * d2);
  }
  // Height 1 - 1/field: a dome whose slope is steep at the edge. Deep inside it is flat,
  // so droplets merged in the body neither glint nor warp the image.
  vec2 slope = gradient / (field * field) * (1.0 - smoothstep(1.5, 6.0, field));
  if (u_dent.w != 0.0) {
    // The pointer presses a bounded dimple: it pulls a nearby edge in and lenses the
    // inside, ringed by ripples. A negative rebound only lifts the surface slightly.
    vec2 d = p - u_dent.xy;
    float distance = max(length(d), 1e-4);
    float dimple = exp(-dot(d, d) / (u_dent.z * u_dent.z)) * u_dent.w;
    float fade = exp(-distance * 9.0) * u_ripple * u_dent.w;
    float wave = u_time * 7.0 - distance * 55.0;
    field += sin(wave) * fade - dimple * 0.7;
    slope += 1.2 * dimple * d / (u_dent.z * u_dent.z) - (55.0 * cos(wave) + 9.0 * sin(wave)) * fade * d / distance;
  }
  float edge = fwidth(field) * 0.75;
  float body = smoothstep(1.0 - edge, 1.0 + edge, field);
  float halo = smoothstep(0.35, 1.0, field) * (1.0 - body) * 0.22;
  vec3 glow = mix(u_violet, u_pink, 0.35);
  if (body <= 0.0) { color = vec4(glow * halo, halo) * u_opacity; return; }
  vec3 normal = normalize(vec3(-slope * 0.12, 1.0));
  // Refraction follows the bounded surface tilt, so small droplets do not over-magnify.
  vec2 inner = p - u_center - normal.xy * u_refraction;
  float twist = u_surge * 1.6 * (1.0 - smoothstep(0.0, 0.45, length(inner)));
  inner = mat2(cos(twist), sin(twist), -sin(twist), cos(twist)) * inner;
  vec3 fill = nebula(inner) * 0.6;
  vec3 c = mix(scene(u_imageA, u_has.x, inner, fill), scene(u_imageB, u_has.y, inner, fill), u_mix);
  vec3 light = normalize(vec3(-0.5, -0.6, 0.62));
  float specular = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 60.0);
  float rim = pow(1.0 - normal.z, 2.0);
  c = min(c + u_white * specular * 0.9 + u_pink * rim * 0.6, vec3(1.0));
  color = vec4(c * body + glow * halo, body + halo) * u_opacity;
}`;
