import * as THREE from 'three';
import type { Quality } from './quality';

/** Cosine palette: smooth rainbow-ish colour from a single number. */
function palette(t: number, out: THREE.Color): THREE.Color {
  out.setRGB(
    0.5 + 0.5 * Math.cos(6.2832 * (t + 0.0)),
    0.5 + 0.5 * Math.cos(6.2832 * (t + 0.33)),
    0.5 + 0.5 * Math.cos(6.2832 * (t + 0.67)),
  );
  return out;
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform float time;
uniform float psy;
uniform float mode;
uniform float modeAmt;
uniform float theme;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float swirl = d.y * 0.9 + sin(d.x * 3.0 + time * 0.2) * 0.25 + sin(d.z * 4.0 - time * 0.15) * 0.25
              + sin(atan(d.z, d.x) * 5.0 + d.y * 6.0 + time * 0.3) * 0.12;
  float t = swirl + time * 0.03;
  vec3 col = 0.5 + 0.5 * cos(6.2832 * (vec3(t) + vec3(0.0, 0.33, 0.67)));
  col *= 0.5 + 0.35 * d.y;
  // aurora ribbons
  float rib = smoothstep(0.0, 0.5, sin(d.y * 14.0 + sin(d.x * 5.0 + time * 0.4) * 2.0 + time * 0.5));
  col += rib * 0.18 * (0.5 + 0.5 * cos(6.2832 * (vec3(t * 2.0) + vec3(0.3, 0.6, 0.0)))) * smoothstep(0.0, 0.5, d.y);
  // pulsing moon with rings
  vec3 m = normalize(vec3(0.4, 0.55, -0.7));
  float md = acos(clamp(dot(d, m), -1.0, 1.0));
  col += vec3(1.0, 0.95, 0.7) * smoothstep(0.16, 0.14, md);
  col += 0.12 * (0.5 + 0.5 * sin(md * 40.0 - time * 2.0)) * smoothstep(0.7, 0.15, md) * vec3(0.8, 0.6, 1.0);
  // twinkling stars
  vec3 g = floor(d * 90.0);
  float h = hash(g);
  float star = step(0.985, h) * 0.8;
  col += star * smoothstep(0.05, 0.4, d.y);
  // the calm night sky you start with: the swirl only comes in as you get hurt
  // a dark, cold night with a pale moon, thin cloud and a few stars
  vec3 calm = mix(vec3(0.075, 0.095, 0.15), vec3(0.012, 0.018, 0.045), smoothstep(-0.05, 0.8, d.y));
  if (theme > 0.5 && theme < 1.5) {
    // ice: a deep teal polar night with green and violet auroras
    calm = mix(vec3(0.1, 0.17, 0.26), vec3(0.015, 0.04, 0.11), smoothstep(-0.05, 0.8, d.y));
    float au = smoothstep(0.35, 1.0, sin(d.x * 3.0 + sin(d.z * 2.2 + time * 0.12) * 1.6 + d.y * 5.0 + time * 0.08));
    calm += vec3(0.1, 0.9, 0.55) * au * 0.5 * smoothstep(0.08, 0.5, d.y);
    calm += vec3(0.55, 0.2, 0.95) * smoothstep(0.5, 1.0, sin(d.x * 2.0 + d.y * 7.0 - time * 0.06)) * 0.28 * smoothstep(0.2, 0.7, d.y);
  } else if (theme > 1.5) {
    // desert: a dusky orange horizon fading up to violet
    calm = mix(vec3(0.85, 0.38, 0.14), vec3(0.14, 0.06, 0.26), smoothstep(-0.05, 0.75, d.y));
  }
  vec3 sn = normalize(vec3(0.35, 0.55, -0.75));
  float sdd = acos(clamp(dot(d, sn), -1.0, 1.0));
  if (theme > 1.5) calm += vec3(1.0, 0.5, 0.15) * smoothstep(0.9, 0.05, sdd) * 0.35;
  calm += vec3(0.85, 0.9, 1.0) * smoothstep(0.075, 0.065, sdd) + vec3(0.3, 0.4, 0.62) * smoothstep(0.55, 0.06, sdd) * 0.2;
  float cl = 0.5 + 0.5 * sin(d.x * 5.0 + time * 0.03 + sin(d.z * 4.0) * 1.6) * sin(d.z * 6.0 - time * 0.02 + sin(d.x * 3.0)) + d.y * 0.5;
  cl = smoothstep(0.6, 0.85, cl) * smoothstep(0.05, 0.3, d.y) * smoothstep(0.98, 0.6, d.y);
  calm = mix(calm, vec3(0.13, 0.15, 0.22), cl * 0.65);
  calm += step(0.992, hash(floor(d * 90.0))) * 0.55 * smoothstep(0.12, 0.5, d.y);
  col = mix(calm, col, psy);
  if (modeAmt > 0.001) {
    vec3 mc = col;
    if (mode < 1.5) {
      // disco: a rainbow dome with sweeping light beams and glitter
      mc = 0.5 + 0.5 * cos(6.2832 * (vec3(d.y * 0.7 + d.x * 0.3 + time * 0.12) + vec3(0.0, 0.33, 0.67)));
      float ang = atan(d.z, d.x);
      float beams = smoothstep(0.82, 1.0, sin(ang * 7.0 + time * 1.7 + d.y * 2.0));
      mc += beams * vec3(1.0, 0.8, 1.0) * smoothstep(0.0, 0.4, d.y) * 0.8;
      mc += step(0.985, hash(floor(d * 60.0))) * 0.8;
    } else if (mode < 2.5) {
      // goth: a black sky and a huge blood moon
      mc = mix(vec3(0.07, 0.01, 0.06), vec3(0.0, 0.0, 0.02), smoothstep(-0.1, 0.8, d.y));
      vec3 bm = normalize(vec3(-0.3, 0.35, -0.85));
      float bd = acos(clamp(dot(d, bm), -1.0, 1.0));
      mc += vec3(0.85, 0.05, 0.1) * smoothstep(0.3, 0.27, bd);
      mc += vec3(0.4, 0.0, 0.1) * smoothstep(0.7, 0.28, bd) * 0.4;
    } else if (mode < 3.5) {
      // turbo: a toxic lime sunrise with speed rays fanning out from the sun
      mc = mix(vec3(0.75, 1.0, 0.12), vec3(0.04, 0.3, 0.32), smoothstep(-0.05, 0.75, d.y));
      vec3 sm = normalize(vec3(0.5, 0.15, -0.85));
      float sd2 = acos(clamp(dot(d, sm), -1.0, 1.0));
      vec3 ax = normalize(cross(sm, vec3(0.0, 1.0, 0.0)));
      vec3 ay = cross(ax, sm);
      float ray = smoothstep(0.55, 1.0, sin(atan(dot(d, ay), dot(d, ax)) * 14.0 + time * 0.25));
      mc += vec3(1.0, 1.0, 0.4) * smoothstep(0.2, 0.17, sd2);
      mc += vec3(0.8, 1.0, 0.2) * ray * smoothstep(1.2, 0.2, sd2) * 0.35;
    } else if (mode < 4.5) {
      // upside down: a violet and orange twilight with drifting ash
      mc = mix(vec3(0.95, 0.45, 0.3), vec3(0.22, 0.08, 0.4), smoothstep(-0.05, 0.7, d.y));
      mc += vec3(0.6, 0.2, 0.8) * 0.25 * (0.5 + 0.5 * sin(d.x * 6.0 + time * 0.3) * sin(d.z * 5.0 - time * 0.2));
      mc += step(0.985, hash(floor(d * 50.0))) * vec3(1.0, 0.7, 0.5);
    } else if (mode < 5.5) {
      // moon: a black star-field and the Earth hanging in it
      float sh = hash(floor(d * 110.0));
      mc = vec3(0.01, 0.01, 0.04) + step(0.975, sh) * 0.85;
      vec3 em = normalize(vec3(-0.45, 0.4, -0.8));
      float ed = acos(clamp(dot(d, em), -1.0, 1.0));
      vec3 earth = mix(vec3(0.1, 0.35, 0.9), vec3(0.2, 0.8, 0.4), 0.5 + 0.5 * sin(d.x * 18.0 + d.y * 9.0));
      earth += vec3(0.25) * smoothstep(0.0, 0.3, 0.5 + 0.5 * sin(d.z * 30.0 + time * 0.05));
      mc = mix(mc, earth, smoothstep(0.24, 0.22, ed));
      mc += vec3(0.3, 0.5, 1.0) * smoothstep(0.34, 0.22, ed) * 0.2;
    } else if (mode < 6.5) {
      // slippery: an icy sky with an aurora
      mc = mix(vec3(0.85, 0.97, 1.0), vec3(0.35, 0.7, 0.95), smoothstep(-0.05, 0.8, d.y));
      float au = smoothstep(0.55, 1.0, sin(d.x * 3.0 + sin(d.z * 2.5 + time * 0.4) * 1.4 + d.y * 5.0 + time * 0.3));
      mc += vec3(0.2, 1.0, 0.7) * au * 0.45 * smoothstep(0.1, 0.5, d.y);
      mc += step(0.99, hash(floor(d * 80.0))) * 0.8 * smoothstep(0.2, 0.6, d.y);
    } else {
      // inferno: a blood-red sky, black ash clouds and a huge angry sun
      mc = mix(vec3(1.0, 0.22, 0.03), vec3(0.1, 0.0, 0.03), smoothstep(-0.05, 0.8, d.y));
      float ash = smoothstep(0.4, 0.9, 0.5 + 0.5 * sin(d.x * 4.0 + sin(d.z * 3.0 + time * 0.05) * 1.5 + d.y * 7.0));
      mc = mix(mc, vec3(0.05, 0.0, 0.02), ash * 0.6 * smoothstep(0.05, 0.4, d.y));
      vec3 hs = normalize(vec3(0.3, 0.3, -0.9));
      float hd = acos(clamp(dot(d, hs), -1.0, 1.0));
      mc += vec3(1.0, 0.7, 0.2) * smoothstep(0.26, 0.23, hd);
      mc += vec3(1.0, 0.3, 0.05) * smoothstep(0.9, 0.2, hd) * 0.3;
    }
    col = mix(col, mc, modeAmt);
  }
    gl_FragColor = vec4(col, 1.0);
}`;

const POST_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = `
uniform sampler2D tDiffuse;
uniform float time;
uniform float amp;
uniform float pulse;
uniform float tint;
uniform float mode;
uniform float modeAmt;
uniform float cyber;
uniform sampler2D tDepth;
uniform float cnear;
uniform float cfar;
uniform float outlineAmt;
uniform vec2 res;
varying vec2 vUv;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * cnear * cfar) / (cfar + cnear - z * (cfar - cnear));
}
// a soft ink line wherever depth jumps (shape silhouettes). The second difference is ~0 on flat ground, so only real edges show.
float inkEdge(vec2 p) {
  vec2 px = 1.0 / res;
  float z0 = linZ(texture2D(tDepth, p).r);
  float zr = linZ(texture2D(tDepth, p + vec2(px.x, 0.0)).r);
  float zl = linZ(texture2D(tDepth, p - vec2(px.x, 0.0)).r);
  float zu = linZ(texture2D(tDepth, p + vec2(0.0, px.y)).r);
  float zd = linZ(texture2D(tDepth, p - vec2(0.0, px.y)).r);
  float e = (abs(zr + zl - 2.0 * z0) + abs(zu + zd - 2.0 * z0)) / min(z0, min(min(zr, zl), min(zu, zd)));
  float fade = 1.0 - smoothstep(30.0, 100.0, min(z0, min(min(zr, zl), min(zu, zd))));
  return smoothstep(0.05, 0.16, e) * fade;
}
float lum(vec3 c) { return sqrt(max(dot(c, vec3(0.299, 0.587, 0.114)), 0.0)); }
vec3 hueRotate(vec3 c, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 y = toYIQ * c;
  float cs = cos(a), sn = sin(a);
  y.yz = mat2(cs, -sn, sn, cs) * y.yz;
  return toRGB * y;
}
void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r = length(c);
  // wobbling, breathing lens
  uv += amp * 0.0015 * vec2(sin(uv.y * 12.0 + time * 0.9), cos(uv.x * 10.0 + time * 0.7));
  uv += c * (amp * 0.025 * sin(time * 0.5)) * (0.3 + r * 2.0);
  // colour fringes
  float ca = amp * 0.0012 * (0.4 + r * 3.0);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + c * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - c * ca).b;
  // colour drift, bounded so the two teams never swap places
  col = hueRotate(col, amp * (sin(time * 0.23) * 0.9 + r * 1.2 * sin(time * 0.31) + pulse * 0.25) + tint);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.0 + 0.55 * amp);
  col *= 1.0 - r * r * (0.08 + 0.4 * amp);
  col = max(col, 0.0);
  if (modeAmt > 0.001) {
    float lum2 = dot(col, vec3(0.299, 0.587, 0.114));
    if (mode < 1.5) {
      // disco: a slow rainbow sweep over everything
      col = mix(col, hueRotate(col, sin(time * 0.7) * 1.0 + uv.x * 0.8), 0.5 * modeAmt);
      col *= 1.0 + 0.12 * modeAmt;
    } else if (mode < 2.5) {
      // goth: drained of colour, dark at the edges
      col = mix(col, vec3(lum2) * vec3(0.85, 0.75, 1.0), 0.75 * modeAmt);
      col *= 1.0 - modeAmt * (0.35 + r * r * 1.4);
    } else if (mode < 3.5) {
      // turbo: lime-hot colours and a rush of zoom blur towards the edges
      vec3 blur = col;
      for (int i = 1; i <= 3; i++) blur += texture2D(tDiffuse, uv - c * (0.014 * float(i)) * modeAmt * (0.3 + r * 2.0)).rgb;
      col = mix(col, blur * 0.25, 0.7 * modeAmt);
      col = mix(col, col * vec3(1.05, 1.2, 0.7) + vec3(0.0, 0.03, 0.0), modeAmt);
    } else if (mode < 4.5) {
      // upside down: a violet-orange grade
      col = mix(col, col * vec3(1.1, 0.8, 1.25) + vec3(0.03, 0.0, 0.05), modeAmt);
      col = mix(col, vec3(lum2) * vec3(1.1, 0.8, 1.3), 0.25 * modeAmt);
    } else if (mode < 5.5) {
      // moon: cold and contrasty
      col = mix(col, vec3(lum2) * vec3(0.9, 0.95, 1.1), 0.5 * modeAmt);
      col = mix(col, pow(col, vec3(1.25)) * 1.15, modeAmt * 0.6);
    } else if (mode < 6.5) {
      // slippery: icy blue
      col = mix(col, col * vec3(0.85, 1.05, 1.25) + vec3(0.0, 0.03, 0.06), modeAmt);
    } else {
      // inferno: red-hot, glowing in the bright parts
      col = mix(col, col * vec3(1.35, 0.78, 0.55) + vec3(0.06, 0.0, 0.0), modeAmt);
      col += modeAmt * 0.6 * max(col - 0.55, 0.0) * vec3(1.0, 0.45, 0.1);
      col *= 1.0 - modeAmt * r * r * 0.5;
    }
  }
  if (outlineAmt > 0.001) col = mix(col, vec3(0.04, 0.015, 0.1), inkEdge(uv) * 0.5 * outlineAmt);
  if (cyber > 0.001) {
    // a touch of cyberpunk: teal in the shadows, magenta in the lights, and a glow on the bright bits
    float cl = dot(col, vec3(0.299, 0.587, 0.114));
    col += cyber * 1.2 * mix(vec3(0.0, 0.45, 0.55), vec3(0.85, 0.05, 0.6), smoothstep(0.12, 0.7, cl)) * (0.35 + cl);
    col += cyber * 1.0 * max(col - 0.6, 0.0) * vec3(0.5, 0.85, 1.0);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** The psychedelic layer: swirling sky, drifting spores, and a warping colour-shifting post effect. */
export class Trip {
  /** 0 = off, 1 = mild, 2 = full. */
  level = 2;
  private rt: THREE.WebGLRenderTarget | null = null;
  private quad: THREE.Mesh | null = null;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private uniforms = {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    amp: { value: 0.5 },
    pulse: { value: 0 },
    tint: { value: 0 },
    mode: { value: 0 },
    modeAmt: { value: 0 },
    res: { value: new THREE.Vector2(1, 1) },
    tDepth: { value: null as THREE.Texture | null },
    cnear: { value: 0.1 },
    cfar: { value: 160 },
    outlineAmt: { value: 0 },
    cyber: { value: 0.1 },
  };
  /** Camera planes, for turning depth back into distance. */
  setPlanes(near: number, far: number) {
    this.uniforms.cnear.value = near;
    this.uniforms.cfar.value = far;
  }
  private sky: THREE.Mesh;
  private spores: THREE.InstancedMesh;
  private sporeSeed: Float32Array;
  private tmpC = new THREE.Color();
  private dummy = new THREE.Object3D();
  private size = new THREE.Vector2();
  postOk = false;
  /** 0 = a normal night forest, 1 = full psychedelia (comes with low health). */
  psy = 0;
  /** A silly mode: 1 disco, 2 goth, 3 turbo, 4 upside down, 5 moon, 6 slippery, 7 inferno, with how strongly it is on (0..1). */
  mode = 1;
  modeAmt = 0;
  /** 0 forest, 1 ice, 2 desert. */
  theme = 0;
  fogCalm: [number, number, number] = [0.05, 0.065, 0.1];

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private q: Quality) {
    this.level = q.post ? 2 : 0;
    // sky dome that always sits on the camera
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(90, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, psy: { value: 0 }, mode: { value: 0 }, modeAmt: { value: 0 }, theme: { value: 0 } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // glowing spores floating around you
    const N = q.spores;
    this.spores = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    this.spores.frustumCulled = false;
    this.spores.setColorAt(0, new THREE.Color(1, 1, 1));
    this.sporeSeed = new Float32Array(N * 4);
    for (let i = 0; i < this.sporeSeed.length; i++) this.sporeSeed[i] = Math.random();
    scene.add(this.spores);

    try {
      const ok = q.post && renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
      if (ok) {
        this.makeTarget();
        this.quad = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false }),
        );
        this.quad.frustumCulled = false;
        this.quadScene.add(this.quad);
        this.postOk = true;
      }
    } catch {
      this.postOk = false;
    }
  }

  private makeTarget() {
    this.renderer.getDrawingBufferSize(this.size);
    this.rt?.dispose();
    const depth = new THREE.DepthTexture(this.size.x, this.size.y);
    depth.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { type: THREE.HalfFloatType, samples: this.q.samples, depthTexture: depth });
    this.uniforms.tDiffuse.value = this.rt.texture;
    this.uniforms.tDepth.value = depth;
    this.uniforms.res.value.set(this.size.x, this.size.y);
  }

  resize() {
    if (this.rt) this.makeTarget();
  }

  /** Match the fog to the horizon colour of the sky so distance fades into the swirl. */
  horizon(t: number, out: THREE.Color): THREE.Color {
    palette(t * 0.03, out).multiplyScalar(0.22);
    out.lerp(this.tmpC.setRGB(this.fogCalm[0], this.fogCalm[1], this.fogCalm[2]), 1 - this.psy); // calm: this map's misty night
    if (this.modeAmt > 0.001) {
      const m = this.mode < 1.5 ? palette(t * 0.12, this.tmpC).multiplyScalar(0.45) : this.mode < 2.5 ? this.tmpC.setRGB(0.04, 0.0, 0.03) : this.mode < 3.5 ? this.tmpC.setRGB(0.22, 0.34, 0.05) : this.mode < 4.5 ? this.tmpC.setRGB(0.45, 0.2, 0.5) : this.mode < 5.5 ? this.tmpC.setRGB(0.02, 0.02, 0.06) : this.mode < 6.5 ? this.tmpC.setRGB(0.8, 0.93, 1.0) : this.tmpC.setRGB(0.42, 0.07, 0.02);
      out.lerp(m, this.modeAmt);
    }
    return out;
  }

  update(t: number, camPos: THREE.Vector3, beat: number) {
    const su = (this.sky.material as THREE.ShaderMaterial).uniforms;
    su.time.value = t;
    su.psy.value = this.psy;
    su.mode.value = this.mode;
    su.modeAmt.value = this.modeAmt;
    su.theme.value = this.theme;
    this.sky.position.copy(camPos);
    // spores drift in a box that follows the camera
    const N = this.spores.count;
    const sd = this.sporeSeed;
    const S = 44;
    const lvl = this.level / 2;
    this.spores.visible = this.level > 0 && (this.psy > 0.05 || this.modeAmt > 0.05);
    if (!this.spores.visible) return;
    for (let i = 0; i < N; i++) {
      const bx = sd[i * 4] * S + Math.sin(t * (0.3 + sd[i * 4 + 3]) + i) * 1.2;
      const bz = sd[i * 4 + 1] * S + Math.cos(t * (0.25 + sd[i * 4 + 3]) + i * 2) * 1.2;
      const by = 0.4 + sd[i * 4 + 2] * 9 + Math.sin(t * 0.8 + i) * 0.6;
      const x = ((bx - camPos.x) % S + S * 1.5) % S - S / 2 + camPos.x;
      const z = ((bz - camPos.z) % S + S * 1.5) % S - S / 2 + camPos.z;
      this.dummy.position.set(x, by, z);
      this.dummy.scale.setScalar((0.8 + 0.6 * Math.sin(t * 2 + i)) * (0.4 + lvl * 0.6) * Math.max(this.psy, this.modeAmt));
      this.dummy.updateMatrix();
      this.spores.setMatrixAt(i, this.dummy.matrix);
      palette(t * 0.1 + i * 0.037, this.tmpC);
      this.spores.setColorAt(i, this.tmpC);
    }
    this.spores.instanceMatrix.needsUpdate = true;
    if (this.spores.instanceColor) this.spores.instanceColor.needsUpdate = true;
  }

  /** Render the scene, through the warp pass if it is available and switched on. */
  render(scene: THREE.Scene, camera: THREE.Camera, t: number, amp: number, beat: number, tint: number) {
    const a = amp * (this.level === 2 ? 1 : this.level === 1 ? 0.4 : 0);
    if (!this.postOk || !this.rt || !this.quad || this.level === 0) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.uniforms.time.value = t;
    this.uniforms.amp.value = a;
    this.uniforms.pulse.value = beat;
    this.uniforms.tint.value = tint;
    this.uniforms.mode.value = this.mode;
    this.uniforms.modeAmt.value = this.modeAmt;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}
