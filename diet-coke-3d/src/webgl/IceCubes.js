import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fresnelGlass } from './materials.js';

// Resting places inside the glass, in glass units (origin at its base).
const LAYOUT = [
  { home: [-0.32, 0.8, 0.18], scale: 0.62, axis: [0.3, 1, 0.2] },
  { home: [0.3, 1.34, -0.14], scale: 0.58, axis: [1, 0.4, 0.1] },
  { home: [-0.12, 1.88, 0.26], scale: 0.6, axis: [0.2, 0.6, 1] },
  { home: [0.26, 2.44, 0.04], scale: 0.54, axis: [0.8, 0.2, 0.5] },
];

// Lands with a small bounce
const settle = (t) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export class IceCubes {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 2;

    const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.16);
    this.material = fresnelGlass({ color: 0x7aa6c4, center: 0.16, edge: 0.88 });

    this.cubes = LAYOUT.map((c, i) => {
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.renderOrder = 2;
      const home = new THREE.Vector3(...c.home);
      mesh.userData = {
        home,
        from: home.clone().add(new THREE.Vector3(0, 5.2, 0)),
        scale: c.scale,
        axis: new THREE.Vector3(...c.axis).normalize(),
        phase: i * 1.7,
        delay: i * 0.12,
        stack: LAYOUT.length - 1 - i,
      };
      mesh.rotation.set(i * 0.9, i * 1.7, i * 0.4);
      this.group.add(mesh);
      return mesh;
    });
  }

  // progress: 0 = still above the glass, 1 = dropped in.
  // level: liquid height; submerged cubes float up under the surface.
  update(time, dt, progress, level, hasLiquid) {
    this.group.visible = progress > 0.002;
    if (!this.group.visible) return;
    for (const cube of this.cubes) {
      const d = cube.userData;
      const p = THREE.MathUtils.clamp((progress - d.delay) / 0.55, 0, 1);
      cube.position.lerpVectors(d.from, d.home, settle(p));
      if (hasLiquid) {
        // The top cube pokes up through the foam, the rest bob underneath
        const floatY = level + 0.12 - d.stack * 0.45;
        if (floatY > cube.position.y) {
          cube.position.y = floatY + Math.sin(time * 1.4 + d.phase) * 0.04;
        }
      }
      cube.scale.setScalar(d.scale * Math.min(1, p * 4 + 0.001));
      cube.rotateOnAxis(d.axis, dt * (hasLiquid ? 0.12 : 0.3));
    }
  }
}
