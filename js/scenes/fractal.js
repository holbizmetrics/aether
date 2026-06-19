// ACT II — the infinite universe.
// A full-screen quad. The fragment shader raymarches a Mandelbulb distance
// field — there is NO geometry in this scene, every pixel is solved by
// marching a ray until it hits the fractal surface. Scroll falls you inward.

import * as THREE from "three";

export function createFractal() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // unused by shader

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTime: { value: 0 },
      uProg: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform vec2 uRes; uniform float uTime; uniform float uProg; uniform vec2 uMouse;

      // Mandelbulb distance estimator
      float DE(vec3 p, out float trap){
        vec3 z = p; float dr = 1.0; float r = 0.0;
        float power = 7.0 + 1.5 * sin(uTime * 0.2);
        trap = 1e10;
        for(int i = 0; i < 8; i++){
          r = length(z);
          if(r > 2.0) break;
          float theta = acos(z.z / r);
          float phi = atan(z.y, z.x);
          dr = pow(r, power - 1.0) * power * dr + 1.0;
          float zr = pow(r, power);
          theta *= power; phi *= power;
          z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + p;
          trap = min(trap, r);
        }
        return 0.5 * log(r) * r / dr;
      }

      // tetrahedron normal — 4 DE evals instead of 6 (cheaper → smoother fps)
      vec3 calcNormal(vec3 p){
        const vec2 k = vec2(1.0, -1.0);
        const float e = 0.0006;
        float t;
        return normalize(
          k.xyy * DE(p + k.xyy * e, t) +
          k.yyx * DE(p + k.yyx * e, t) +
          k.yxy * DE(p + k.yxy * e, t) +
          k.xxx * DE(p + k.xxx * e, t)
        );
      }

      mat3 camBasis(vec3 ro, vec3 ta){
        vec3 f = normalize(ta - ro);
        vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
        vec3 u = cross(f, r);
        return mat3(r, u, f);
      }

      void main(){
        vec2 uv = (vUv * 2.0 - 1.0);
        uv.x *= uRes.x / uRes.y;

        // camera orbits, and falls inward as you scroll (uProg 0..1)
        float ang = uTime * 0.12 + uMouse.x * 0.6;
        // slow continuous breathing so the camera glides even when you stop scrolling
        float dist = mix(2.6, 1.18, smoothstep(0.0, 1.0, uProg)) + sin(uTime * 0.15) * 0.05;
        vec3 ro = vec3(cos(ang) * dist, 0.35 + uMouse.y * 0.4, sin(ang) * dist);
        vec3 ta = vec3(0.0);
        vec3 rd = camBasis(ro, ta) * normalize(vec3(uv, 1.4));

        float t = 0.0, trap = 0.0;
        float minD = 1e9;       // closest approach → bounded halo (no runaway accumulation)
        bool hit = false;
        vec3 p = ro;
        for(int i = 0; i < 96; i++){
          p = ro + rd * t;
          float tr; float d = DE(p, tr);
          minD = min(minD, d);
          if(d < 0.001){ trap = tr; hit = true; break; }
          t += d * 0.9;
          if(t > 6.0) break;
        }

        vec3 col = vec3(0.0);
        if(hit){
          vec3 n = calcNormal(p);
          vec3 lig = normalize(vec3(0.7, 0.8, -0.5));
          float dif = clamp(dot(n, lig), 0.0, 1.0);
          float amb = 0.5 + 0.5 * n.y;
          float ao = 1.0 / (1.0 + t * 0.35);  // farther hits sit in shadow → depth
          // orbit-trap palette → iridescent fractal skin
          vec3 base = 0.5 + 0.5 * cos(6.2831 * (trap * 1.5 + vec3(0.0, 0.33, 0.66)) + uTime * 0.3);
          col = base * (0.18 * amb + 0.7 * dif) * ao;
          float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
          col += fres * vec3(0.2, 0.5, 0.9) * 0.5; // soft fresnel rim
        }
        col += exp(-minD * 7.0) * vec3(0.18, 0.32, 0.7); // bounded cyan halo
        col = col / (1.0 + col);          // Reinhard tone map → can never blow out to white
        col = pow(col, vec3(0.85));       // gentle gamma
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  return {
    scene,
    camera,
    update(local, t, _dt, mouse) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uProg.value = local;
      mat.uniforms.uMouse.value.set(mouse.x, mouse.y);
    },
    resize(w, h) {
      mat.uniforms.uRes.value.set(w, h);
    },
  };
}
