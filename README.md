# AETHER

**A single-page WebGL experience — scroll through three impossible worlds, all running live in your browser, all procedural, zero downloaded assets.**

> Act I — a living swarm of half a million GPU particles that morph between shapes
> Act II — an infinite raymarched fractal universe you fall into forever
> Act III — molten liquid glass: real-time refraction, chromatic dispersion, reflections
>
> …tied together by a scroll-driven cinematic camera and bloom.

The whole point is the reaction: *"wait — this is a **browser**? how?"*

## Run it

It's a static site with **no build step**. Any static server works:

```bash
# pick one
python -m http.server 8000
npx serve .
```

Then open <http://localhost:8000>. (Opening `index.html` directly via `file://` will fail — ES-module imports need a server.)

## Deploy (GitHub Pages)

Push to GitHub → **Settings → Pages → Deploy from branch → `main` / root**. Done. Three.js loads from a CDN via an import map, so there's nothing to bundle.

## How it works

| Layer | Tech |
|---|---|
| Engine | [Three.js](https://threejs.org) `r160` via ESM import map |
| Act I — swarm | `THREE.Points`, GPU vertex-shader morph between target point-clouds, additive blending |
| Act II — fractal | full-screen quad, **raymarched** Mandelbulb distance field in GLSL |
| Act III — glass | `MeshPhysicalMaterial` transmission + IOR + dispersion, procedural environment |
| Glue | scroll → eased progress → per-act camera + cinematic fade-through-black |
| Glow | `UnrealBloomPass` post-processing |

Each act is a self-contained module in `js/scenes/` exposing `{ scene, camera, update(), resize() }`. `js/main.js` maps scroll position to the active act and renders it through the shared bloom composer.

## Performance notes

Desktop-GPU-first. Pixel ratio is capped at 2×; particle count and raymarch step count are the main knobs (top of each scene module) if you want it lighter for phones.

## Soundtrack

`audio/track.mp3` — *"Pink Flamingo"*, an original track made by Holger with [Suno](https://suno.com). The visuals react to it live (bloom, swarm, and glass highlights pulse with the bass).

## License

MIT © Holger — code. The soundtrack is the author's own work; please don't reuse it without permission.
