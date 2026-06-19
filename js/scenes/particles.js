// ACT I — the living swarm.
// 500,000 points. Each point carries FOUR target positions (the word "AETHER",
// a galaxy, a double helix, a heart). The vertex shader morphs between them as
// you scroll, adds a breathing flow field, and the whole thing glows via bloom.
// No mesh, no model — the shapes are generated procedurally at load.

import * as THREE from "three";

const COUNT = 500000; // ← performance knob: drop to 200000 for weaker GPUs

// ---------- target generators ----------

// Sample the word from a 2D canvas → 3D point plane
function targetText(arr, count, word = "AETHER") {
  const cw = 1100, ch = 300;
  const cnv = document.createElement("canvas");
  cnv.width = cw; cnv.height = ch;
  const ctx = cnv.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "#fff";
  ctx.font = "800 200px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(word, cw / 2, ch / 2);
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const pts = [];
  for (let y = 0; y < ch; y += 2) {
    for (let x = 0; x < cw; x += 2) {
      if (data[(y * cw + x) * 4] > 128) pts.push([x, y]);
    }
  }
  const scale = 0.07;
  for (let i = 0; i < count; i++) {
    const p = pts[i % pts.length];
    arr[i * 3]     = (p[0] - cw / 2) * scale + (Math.random() - 0.5) * 0.3;
    arr[i * 3 + 1] = -(p[1] - ch / 2) * scale + (Math.random() - 0.5) * 0.3;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
  }
}

// Spiral galaxy disk
function targetGalaxy(arr, count) {
  const arms = 4, R = 42;
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.5) * R;
    const arm = (i % arms) * (Math.PI * 2 / arms);
    const ang = arm + r * 0.16 + (Math.random() - 0.5) * 0.6;
    const fuzz = (1 - r / R) * 2.5;
    arr[i * 3]     = Math.cos(ang) * r + (Math.random() - 0.5) * fuzz;
    arr[i * 3 + 1] = (Math.random() - 0.5) * (1.5 + (1 - r / R) * 4);
    arr[i * 3 + 2] = Math.sin(ang) * r + (Math.random() - 0.5) * fuzz;
  }
}

// Double helix
function targetHelix(arr, count) {
  const turns = 6, H = 60, R = 14;
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const strand = i % 2;
    const theta = u * turns * Math.PI * 2 + strand * Math.PI;
    const rung = Math.random() < 0.18; // some points form the cross-rungs
    const r = rung ? Math.random() * R : R + (Math.random() - 0.5) * 1.5;
    const th = rung ? (strand * Math.PI + u * turns * Math.PI * 2) : theta;
    arr[i * 3]     = Math.cos(th) * r;
    arr[i * 3 + 1] = (u - 0.5) * H;
    arr[i * 3 + 2] = Math.sin(th) * r;
  }
}

// 3D heart (parametric outline, filled, with depth)
function targetHeart(arr, count) {
  const s = 1.6;
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const k = Math.pow(Math.random(), 0.5); // fill toward edge
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    arr[i * 3]     = x * k * s;
    arr[i * 3 + 1] = y * k * s;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 10 * (1 - k * 0.5);
  }
}

// ---------- build ----------

export function createParticles() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 72);

  const geo = new THREE.BufferGeometry();
  const t0 = new Float32Array(COUNT * 3);
  const t1 = new Float32Array(COUNT * 3);
  const t2 = new Float32Array(COUNT * 3);
  const t3 = new Float32Array(COUNT * 3);
  targetText(t0, COUNT);
  targetGalaxy(t1, COUNT);
  targetHelix(t2, COUNT);
  targetHeart(t3, COUNT);

  const sizes = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3);
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    sizes[i] = 0.6 + Math.random() * Math.random() * 2.4;
    // hue ribbon from cyan → violet → warm white
    c.setHSL(0.5 + Math.random() * 0.18, 0.85, 0.6 + Math.random() * 0.25);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  // position attribute is required; start at t0
  geo.setAttribute("position", new THREE.BufferAttribute(t0.slice(), 3));
  geo.setAttribute("aT0", new THREE.BufferAttribute(t0, 3));
  geo.setAttribute("aT1", new THREE.BufferAttribute(t1, 3));
  geo.setAttribute("aT2", new THREE.BufferAttribute(t2, 3));
  geo.setAttribute("aT3", new THREE.BufferAttribute(t3, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPhase: { value: 0 },
      uTime: { value: 0 },
      uPix: { value: 1 },
      uPulse: { value: 0 }, // bass energy from the music
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aT0; attribute vec3 aT1; attribute vec3 aT2; attribute vec3 aT3;
      attribute float aSize; attribute vec3 aColor;
      uniform float uPhase; uniform float uTime; uniform float uPix; uniform float uPulse;
      varying vec3 vColor; varying float vTw;
      vec3 pick(int s){ if(s==0) return aT0; if(s==1) return aT1; if(s==2) return aT2; return aT3; }
      void main(){
        float ph = clamp(uPhase, 0.0, 3.0);
        int seg = int(floor(ph));
        float f = smoothstep(0.0, 1.0, fract(ph));
        vec3 pos = mix(pick(seg), pick(min(seg + 1, 3)), f);
        // breathing flow field
        float n = sin(pos.x * 0.14 + uTime * 0.7)
                + cos(pos.y * 0.15 + uTime * 0.6)
                + sin(pos.z * 0.13 + uTime * 0.5);
        pos += normalize(pos + 0.0001) * n * 0.7;
        vColor = aColor;
        vTw = 0.5 + 0.5 * sin(uTime * 2.2 + aSize * 9.0);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * uPix * (110.0 / -mv.z) * (1.0 + uPulse * 0.4), 0.8, 6.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uPulse;
      varying vec3 vColor; varying float vTw;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        a *= a * 0.42;
        vec3 col = vColor * (0.28 + 0.5 * vTw) * (1.0 + uPulse * 0.35);
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // a faint starfield so the void isn't empty during morphs
  const starGeo = new THREE.BufferGeometry();
  const sc = 6000, sp = new Float32Array(sc * 3);
  for (let i = 0; i < sc * 3; i++) sp[i] = (Math.random() - 0.5) * 800;
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  // Soft round sprite — without a map, point-sprites render as SQUARES, and with
  // size-attenuation a star near the camera balloons into a big square on parallax.
  const starCanvas = document.createElement("canvas");
  starCanvas.width = starCanvas.height = 32;
  const sx = starCanvas.getContext("2d");
  const sg = sx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sg.addColorStop(0, "rgba(255,255,255,1)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  sx.fillStyle = sg; sx.fillRect(0, 0, 32, 32);
  const starTex = new THREE.CanvasTexture(starCanvas);
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    map: starTex, color: 0x9fb6e6, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  return {
    scene,
    camera,
    update(local, t, _dt, mouse, audio) {
      mat.uniforms.uPhase.value = local * 3.0; // scroll morphs across all 4 shapes
      mat.uniforms.uTime.value = t;
      mat.uniforms.uPulse.value = audio ? audio.bass : 0.0;
      // gentle auto-rotate + mouse parallax
      points.rotation.y = t * 0.04 + mouse.x * 0.35;
      points.rotation.x = mouse.y * 0.22;
      stars.rotation.y = t * 0.01;
      camera.position.x += (mouse.x * 6 - camera.position.x) * 0.04;
      camera.position.y += (mouse.y * 4 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      mat.uniforms.uPix.value = Math.min(window.devicePixelRatio, 2);
    },
  };
}
