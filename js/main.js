// AETHER — orchestrator.
// One renderer, one bloom composer. Scroll position picks the active "act";
// each act owns its own scene + camera. Between acts we fade through black
// (cinematic cut that also hides the scene swap).

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { createParticles } from "./scenes/particles.js";
import { createFractal } from "./scenes/fractal.js";
import { createGlass } from "./scenes/glass.js";

const canvas = document.getElementById("stage");

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.body.innerHTML = '<div class="webgl-error">This experience needs WebGL. Try a recent desktop browser with hardware acceleration on.</div>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// --- Bloom pipeline (shared across acts) ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,  // strength — was 0.85, blew the swarm out to solid white
  0.4,   // radius
  0.55   // threshold — only genuinely bright cores bloom now
);
composer.addPass(bloom);

// --- Build the three acts ---
const acts = [
  { name: "swarm",   make: createParticles, start: 0.00, end: 0.34 },
  { name: "fractal", make: createFractal,   start: 0.38, end: 0.66 },
  { name: "glass",   make: createGlass,     start: 0.70, end: 1.00 },
];
for (const a of acts) a.obj = a.make(renderer);

// --- Scroll → state mapping ---
// Returns which act is active, local progress 0..1 within it, and a 0..1
// fade value that peaks in the gaps between acts.
function getState(p) {
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    if (p >= a.start && p <= a.end) {
      return { i, local: (p - a.start) / (a.end - a.start), fade: 0 };
    }
  }
  // In a gap between act i and i+1
  for (let i = 0; i < acts.length - 1; i++) {
    const e = acts[i].end, s = acts[i + 1].start;
    if (p > e && p < s) {
      const mid = (e + s) / 2;
      if (p < mid) return { i, local: 1, fade: (p - e) / (mid - e) };
      return { i: i + 1, local: 0, fade: (s - p) / (s - mid) };
    }
  }
  return { i: 0, local: 0, fade: 0 };
}

// --- Scroll tracking (eased) ---
let targetP = 0, smoothP = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  targetP = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener("scroll", readScroll, { passive: true });
readScroll();

// --- Mouse parallax ---
const mouse = new THREE.Vector2(0, 0);
window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

// --- Overlay DOM ---
const fadeEl = document.getElementById("fade");
const progressEl = document.getElementById("progress");
const hudActs = [...document.querySelectorAll("#hud .acts span")];
const copies = [...document.querySelectorAll(".copy")];
const loader = document.getElementById("loader");

// Reveal chapter copy when it enters the viewport
const io = new IntersectionObserver((entries) => {
  for (const en of entries) en.target.classList.toggle("in", en.isIntersecting);
}, { threshold: 0.45 });
copies.forEach((c) => io.observe(c));

// --- Resize ---
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  for (const a of acts) a.obj.resize(w, h);
  readScroll();
}
window.addEventListener("resize", resize);

// --- Render loop ---
const clock = new THREE.Clock();
let activeIndex = -1;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Ease scroll for buttery camera moves
  smoothP += (targetP - smoothP) * Math.min(dt * 6, 1);
  const st = getState(smoothP);
  const act = acts[st.i];

  // Update + render the active act
  act.obj.update(st.local, t, dt, mouse);
  renderPass.scene = act.obj.scene;
  renderPass.camera = act.obj.camera;
  composer.render();

  // Transitions + HUD
  fadeEl.style.opacity = (st.fade * st.fade).toFixed(3);
  progressEl.style.width = (smoothP * 100).toFixed(1) + "%";
  if (st.i !== activeIndex) {
    activeIndex = st.i;
    hudActs.forEach((s) => s.classList.toggle("on", +s.dataset.i === st.i));
  }
}

// Kick off once the first act's GPU resources are warm
requestAnimationFrame(() => {
  frame();
  setTimeout(() => loader.classList.add("gone"), 400);
});

// Repo link (set yours here once the repo is pushed)
document.getElementById("repolink").href = "https://github.com/holbizmetrics/aether";
