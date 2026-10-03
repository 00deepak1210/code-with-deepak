import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Resting positions around the can, in can-scale units.
const LAYOUT = [
  { home: [-1.8, 1.2, 0.9], scale: 0.56, axis: [0.3, 1, 0.2] },
  { home: [1.7, 1.55, -0.5], scale: 0.5, axis: [1, 0.4, 0.1] },
  { home: [1.95, -0.8, 0.8], scale: 0.62, axis: [0.2, 0.6, 1] },
  { home: [-1.6, -1.3, -0.3], scale: 0.48, axis: [0.8, 0.2, 0.5] },
  { home: [0.4, 2.4, -1.1], scale: 0.4, axis: [0.4, 1, 0.7] },
  { home: [-0.6, -2.2, 1.2], scale: 0.44, axis: [1, 1, 0.2] },
];

export class IceCubes {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.16);
    // Real transmission would sample a white-cleared buffer on our transparent
    // canvas and turn milky, so fake glass instead: see-through in the middle,
    // denser and more reflective towards the edges (Fresnel).
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x7aa6c4,
      metalness: 0,
      roughness: 0.05,
      ior: 1.31,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      specularIntensity: 1,
      envMapIntensity: 1.8,
      transparent: true,
      depthWrite: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float facing = abs(dot(normalize(vViewPosition), normal));
        float rim = pow(1.0 - facing, 1.5);
        float glint = smoothstep(0.65, 1.0, dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
        gl_FragColor.a = clamp(mix(0.14, 0.88, rim) + glint * 0.6, 0.0, 1.0);`,
      );
    };

    this.cubes = LAYOUT.map((c, i) => {
      const mesh = new THREE.Mesh(geometry, this.material);
      const home = new THREE.Vector3(...c.home);
      mesh.userData = {
        home,
        from: home.clone().multiplyScalar(3.4).add(new THREE.Vector3(0, -2.5, 3)),
        scale: c.scale,
        axis: new THREE.Vector3(...c.axis).normalize(),
        phase: i * 1.7,
        delay: i * 0.07,
      };
      mesh.rotation.set(i * 0.9, i * 1.7, i * 0.4);
      this.group.add(mesh);
      return mesh;
    });
  }

  update(time, dt, progress, anchor, scale) {
    this.group.visible = progress > 0.002;
    if (!this.group.visible) return;
    this.group.position.copy(anchor);
    this.group.scale.setScalar(scale);
    for (const cube of this.cubes) {
      const d = cube.userData;
      const p = THREE.MathUtils.clamp((progress - d.delay) / 0.6, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      cube.position.lerpVectors(d.from, d.home, e);
      cube.position.y += Math.sin(time * 0.9 + d.phase) * 0.08;
      cube.scale.setScalar(d.scale * Math.max(e, 0.001));
      cube.rotateOnAxis(d.axis, dt * 0.35);
    }
  }
}
