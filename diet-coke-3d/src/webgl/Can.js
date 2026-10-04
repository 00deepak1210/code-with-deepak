import * as THREE from 'three';
import {
  createCondensationTexture,
  createLabelMaterialTexture,
  createLabelTexture,
  createLidTexture,
} from './textures.js';

// Proportions of a standard 12 fl oz can, in units of the body radius.
export const CAN = {
  radius: 1,
  bodyBottom: 0.3,
  bodyTop: 3.3,
  lidY: 3.625,
  lidRadius: 0.775,
  height: 3.72,
};

// Opening outline on the lid, in lid units (x, z) with +z towards the viewer.
// Kept in sync with mouthOutline() in textures.js.
const MOUTH = [
  [0, 0.17],
  [0.13, 0.17, 0.26, 0.4, 0.23, 0.55],
  [0.21, 0.665, -0.21, 0.665, -0.23, 0.55],
  [-0.26, 0.4, -0.13, 0.17, 0, 0.17],
];
export const MOUTH_CENTER = new THREE.Vector3(0, CAN.lidY + 0.02, 0.42);
// Where poured liquid leaves the can: on the rim, just past the opening.
const POUR_LIP = new THREE.Vector3(0, CAN.height - 0.02, 0.86);

export class Can {
  constructor({ renderer, flavor, labelSize }) {
    this.renderer = renderer;
    this.labelSize = labelSize;
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.labels = new Map();

    // root: position, scale, tilt · spin: rotation around the can's own axis
    this.root = new THREE.Group();
    this.spin = new THREE.Group();
    this.model = new THREE.Group();
    this.model.position.y = -CAN.height / 2;
    this.root.add(this.spin);
    this.spin.add(this.model);
    // Lid, tab and opening are turned a quarter so the opening sits on the
    // right-hand edge when the logo faces us: that's the edge the can pours
    // from, with the vertical logo reading left to right.
    this.lidGroup = new THREE.Group();
    this.lidGroup.rotation.y = Math.PI / 2;
    this.model.add(this.lidGroup);
    this.pourLip = new THREE.Object3D();
    this.pourLip.position.copy(POUR_LIP);
    this.lidGroup.add(this.pourLip);

    this.createMaterials(flavor);
    this.createBody();
    this.createTop();
    this.createBottom();
    this.createTab();
    this.createMouth();
  }

  createMaterials(flavor) {
    const label = this.getLabel(flavor);
    this.condensation = createCondensationTexture();

    this.labelMaterial = new THREE.MeshPhysicalMaterial({
      map: label.map,
      metalnessMap: label.material,
      roughnessMap: label.material,
      metalness: 1,
      roughness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      normalMap: this.condensation,
      normalScale: new THREE.Vector2(0, 0),
    });

    this.aluminium = new THREE.MeshPhysicalMaterial({
      color: 0xe2e5e8,
      metalness: 1,
      roughness: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
    });

    this.lidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc9cdd2,
      metalness: 1,
      roughness: 0.3,
      bumpMap: createLidTexture(CAN.lidRadius),
      bumpScale: 3,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
    });

    this.tabMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdde0e3,
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.7,
      clearcoatRoughness: 0.1,
    });

    this.mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0x040202,
      roughness: 0.35,
      metalness: 0,
      envMapIntensity: 0.35,
    });
  }

  createBody() {
    const h = CAN.bodyTop - CAN.bodyBottom;
    // thetaStart = PI puts u = 0.5 (the front of the artwork) on +z
    const geometry = new THREE.CylinderGeometry(CAN.radius, CAN.radius, h, 160, 1, true, Math.PI, Math.PI * 2);
    geometry.translate(0, CAN.bodyBottom + h / 2, 0);
    this.body = new THREE.Mesh(geometry, this.labelMaterial);
    this.model.add(this.body);
  }

  createTop() {
    // Shoulder, neck, double-seam rim and countersink as one lathed profile
    const p = new THREE.Path();
    p.moveTo(1, CAN.bodyTop);
    p.bezierCurveTo(1, 3.43, 0.862, 3.5, 0.848, 3.6);
    p.lineTo(0.845, 3.64);
    p.bezierCurveTo(0.845, 3.66, 0.864, 3.668, 0.864, 3.689);
    p.bezierCurveTo(0.864, 3.713, 0.836, 3.721, 0.82, 3.714);
    p.bezierCurveTo(0.806, 3.707, 0.804, 3.69, 0.803, 3.66);
    p.lineTo(0.8, 3.615);
    p.bezierCurveTo(0.797, 3.598, 0.782, 3.598, 0.776, 3.612);
    p.lineTo(CAN.lidRadius, CAN.lidY);
    this.top = new THREE.Mesh(new THREE.LatheGeometry(p.getSpacedPoints(140), 160), this.aluminium);
    this.model.add(this.top);

    const lid = new THREE.CircleGeometry(CAN.lidRadius, 120);
    lid.rotateX(-Math.PI / 2);
    this.lid = new THREE.Mesh(lid, this.lidMaterial);
    this.lid.position.y = CAN.lidY;
    this.lidGroup.add(this.lid);
  }

  createBottom() {
    // Domed base and stand ring, flowing into the straight wall
    const p = new THREE.Path();
    p.moveTo(0, 0.13);
    p.bezierCurveTo(0.3, 0.13, 0.62, 0.1, 0.7, 0.04);
    p.bezierCurveTo(0.73, 0.015, 0.742, 0, 0.762, 0);
    p.bezierCurveTo(0.787, 0, 0.802, 0.012, 0.822, 0.035);
    p.bezierCurveTo(0.9, 0.12, 1, 0.18, 1, CAN.bodyBottom);
    this.bottom = new THREE.Mesh(new THREE.LatheGeometry(p.getSpacedPoints(90), 160), this.aluminium);
    this.model.add(this.bottom);
  }

  createTab() {
    // Drawn flat in XY: +y runs to the finger ring (back of the can),
    // -y is the nose that sits over the opening.
    const s = new THREE.Shape();
    s.moveTo(-0.1, -0.15);
    s.quadraticCurveTo(0, -0.215, 0.1, -0.15);
    s.lineTo(0.135, 0.02);
    s.bezierCurveTo(0.17, 0.12, 0.17, 0.36, 0.12, 0.43);
    s.quadraticCurveTo(0, 0.51, -0.12, 0.43);
    s.bezierCurveTo(-0.17, 0.36, -0.17, 0.12, -0.135, 0.02);
    s.lineTo(-0.1, -0.15);
    const ring = new THREE.Path();
    ring.absellipse(0, 0.27, 0.085, 0.115, 0, Math.PI * 2, true);
    const slot = new THREE.Path();
    slot.absellipse(0, 0.08, 0.05, 0.02, 0, Math.PI * 2, true);
    s.holes.push(ring, slot);

    const geometry = new THREE.ExtrudeGeometry(s, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.007,
      bevelSegments: 2,
      curveSegments: 40,
    });
    geometry.rotateX(-Math.PI / 2); // lay it on the lid: shape +y → world -z

    this.tabPivot = new THREE.Group();
    this.tabPivot.position.set(0, CAN.lidY + 0.012, 0);
    this.tabPivot.add(new THREE.Mesh(geometry, this.tabMaterial));

    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.03, 32), this.tabMaterial);
    rivet.position.set(0, CAN.lidY + 0.018, 0);
    this.lidGroup.add(this.tabPivot, rivet);
  }

  createMouth() {
    // Shape space uses y = -z so rotateX(-PI/2) maps it back onto +z.
    const s = new THREE.Shape();
    const [start, ...curves] = MOUTH;
    s.moveTo(start[0], -start[1]);
    for (const c of curves) s.bezierCurveTo(c[0], -c[1], c[2], -c[3], c[4], -c[5]);
    const geometry = new THREE.ShapeGeometry(s, 24);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -0.17); // pivot on the narrow end so it tears open outward

    this.mouth = new THREE.Mesh(geometry, this.mouthMaterial);
    this.mouth.position.set(0, CAN.lidY + 0.003, 0.17);
    this.mouth.visible = false;
    this.lidGroup.add(this.mouth);
  }

  getLabel(flavor) {
    if (!this.labels.has(flavor.id)) {
      this.labels.set(flavor.id, {
        map: createLabelTexture(flavor, this.labelSize, this.anisotropy),
        material: createLabelMaterialTexture(flavor, this.labelSize / 2, this.anisotropy),
      });
    }
    return this.labels.get(flavor.id);
  }

  // Paint and upload a flavor's label ahead of time so swapping never hitches.
  prepare(flavor) {
    const label = this.getLabel(flavor);
    this.renderer.initTexture(label.map);
    this.renderer.initTexture(label.material);
  }

  setFlavor(flavor) {
    const label = this.getLabel(flavor);
    this.labelMaterial.map = label.map;
    this.labelMaterial.metalnessMap = label.material;
    this.labelMaterial.roughnessMap = label.material;
  }

  setTab(v) {
    this.tabPivot.rotation.x = v * 1.15;
  }

  setMouth(v) {
    this.mouth.visible = v > 0.001;
    this.mouth.scale.setScalar(Math.max(v, 0.001));
  }

  setFrost(v) {
    this.labelMaterial.normalScale.set(v * 0.6, -v * 0.6);
    this.labelMaterial.clearcoatRoughness = 0.07 + v * 0.08;
  }
}
