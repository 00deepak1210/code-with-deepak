import * as THREE from 'three';

// A tiny virtual photo studio: tall softbox strips around the can give the
// aluminium those long, crisp vertical highlights you see in product shots.
// It is rendered once into a pre-filtered environment map (PMREM).
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x141417);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const panel = (w, h, intensity, position, color = 0xffffff) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    return mesh;
  };

  panel(1.5, 14, 8, [-6, 0.5, 4]); // key strip, front left
  panel(2.6, 14, 2.4, [7, 0, 3]); // soft fill, front right
  panel(0.7, 14, 6, [-5, 0, -6]); // rim, back left
  panel(0.9, 14, 5, [5.5, 0, -5]); // rim, back right
  panel(9, 9, 1.7, [0, 8, 0]); // overhead softbox
  panel(12, 7, 0.55, [0, 1, 10]); // broad front fill
  panel(30, 30, 0.35, [0, -7, 0], 0xfff2ea); // warm floor bounce
  panel(3, 14, 0.7, [0, 0, -9], 0xfff1ee); // faint warm backdrop glow

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, 0.03);
  pmrem.dispose();
  geometry.dispose();
  studio.traverse((o) => o.material?.dispose());
  return target.texture;
}
