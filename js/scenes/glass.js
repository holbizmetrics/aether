// ACT III — molten glass.
// Real physically-based refraction: MeshPhysicalMaterial with transmission +
// index-of-refraction bends light through the glass; a studio environment
// (generated procedurally via PMREM) gives live reflections; iridescence
// paints rainbow edges. Chrome companions reflect the same room.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function createGlass(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Procedural studio environment → reflections without any HDRI file
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // Colored key lights for highlights and a sense of "room"
  const l1 = new THREE.PointLight(0x6cf0ff, 600, 60); l1.position.set(10, 8, 10);
  const l2 = new THREE.PointLight(0xff5cc8, 500, 60); l2.position.set(-12, -6, 6);
  const l3 = new THREE.PointLight(0xffffff, 200, 60); l3.position.set(0, 12, -8);
  scene.add(l1, l2, l3);

  const glassMat = new THREE.MeshPhysicalMaterial({
    transmission: 1.0,
    thickness: 2.2,
    ior: 1.55,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 480],
    envMapIntensity: 1.4,
    attenuationColor: new THREE.Color(0x88e6ff),
    attenuationDistance: 3.0,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 1.0, roughness: 0.02, envMapIntensity: 1.6,
  });

  const group = new THREE.Group();
  scene.add(group);

  // Hero: a glass torus knot (leaner tessellation → steadier fps)
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(2.0, 0.6, 170, 26), glassMat);
  group.add(knot);

  // Chrome + glass companions orbiting the hero
  const companions = [];
  const geoms = [
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.SphereGeometry(0.7, 48, 48),
    new THREE.DodecahedronGeometry(0.75, 0),
  ];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(geoms[i % geoms.length], i % 2 ? chromeMat : glassMat);
    const a = (i / 5) * Math.PI * 2;
    m.userData = { a, r: 4.6 + (i % 3) * 0.6, y: Math.sin(i) * 1.8, spin: 0.3 + Math.random() };
    companions.push(m);
    group.add(m);
  }

  return {
    scene,
    camera,
    update(local, t, _dt, mouse, audio) {
      const b = audio ? audio.bass : 0.0;
      l1.intensity = 600 * (1.0 + b * 1.2);   // highlights pulse with the music
      l2.intensity = 500 * (1.0 + b * 1.2);
      knot.rotation.x = t * 0.3;
      knot.rotation.y = t * 0.22;
      for (const m of companions) {
        const u = m.userData;
        const a = u.a + t * 0.25;
        m.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.5 + u.a) * 0.5, Math.sin(a) * u.r);
        m.rotation.x += 0.01 * u.spin;
        m.rotation.y += 0.013 * u.spin;
      }
      // camera pushes in slightly as you scroll, plus mouse parallax
      const dist = 9 - local * 2.2;
      camera.position.x += (mouse.x * 2.5 - camera.position.x) * 0.04;
      camera.position.y += (mouse.y * 1.8 - camera.position.y) * 0.04;
      camera.position.z += (dist - camera.position.z) * 0.04;
      camera.lookAt(0, 0, 0);
      group.rotation.y = t * 0.05;
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
