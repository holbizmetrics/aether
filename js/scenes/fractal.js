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

      vec3 calcNormal(vec3 p){
        float e = 0.0005; float t;
        vec2 h = vec2(e, 0.0);
        return normalize(vec3(
          DE(p + h.xyy, t) - DE(p - h.xyy, t),
          DE(p + h.yxy, t) - DE(p - h.yxy, t),
          DE(p + h.yyx, t) - DE(p - h.yyx, t)
        ));
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
        float dist = mix(2.6, 1.18, smoothstep(0.0, 1.0, uProg));
        vec3 ro = vec3(cos(ang) * dist, 0.35 + uMouse.y * 0.4, sin(ang) * dist);
        vec3 ta = vec3(0.0);
        vec3 rd = camBasis(ro, ta) * normalize(vec3(uv, 1.4));

        float t = 0.0, trap = 0.0, glow = 0.0;
        bool hit = false;
        for(int i = 0; i < 110; i++){
          vec3 p = ro + rd * t;
          float tr; float d = DE(p, tr);
          glow += 0.012 / (0.01 + d * d * 60.0); // volumetric haze near the surface
          if(d < 0.0008){ trap = tr; hit = true; break; }
          t += d * 0.85;
          if(t > 6.0) break;
        }

        vec3 col = vec3(0.0);
        if(hit){
          vec3 p = ro + rd * t;
          vec3 n = calcNormal(p);
          vec3 lig = normalize(vec3(0.7, 0.8, -0.5));
          float dif = clamp(dot(n, lig), 0.0, 1.0);
          float amb = 0.4 + 0.6 * n.y;
          // orbit-trap palette → iridescent fractal skin
          vec3 base = 0.5 + 0.5 * cos(6.2831 * (trap * 1.4 + vec3(0.0, 0.33, 0.66)) + uTime * 0.3);
          col = base * (amb * 0.5 + dif);
          col += pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0) * vec3(0.3, 0.7, 1.0); // fresnel rim
        }
        col += glow * vec3(0.35, 0.55, 1.0); // cyan nebula glow
        col = pow(col, vec3(0.85)); // soft gamma
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
