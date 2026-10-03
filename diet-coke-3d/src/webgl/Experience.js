import * as THREE from 'three';
import gsap from 'gsap';
import { Can, CAN, MOUTH_CENTER } from './Can.js';
import { Bubbles, Burst } from './Bubbles.js';
import { IceCubes } from './IceCubes.js';
import { createStudioEnvironment } from './environment.js';
import { createShadowTexture } from './textures.js';

const TAU = Math.PI * 2;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Every value the scroll choreography can animate. x / y are fractions of the
// half viewport (-1 = left / bottom edge, 1 = right / top edge), so the
// layout stays correct at any screen size.
export const BASE_STATE = {
  x: 0,
  y: 0,
  scale: 1,
  rx: 0,
  ry: 0,
  rz: 0,
  spin: 0, // continuous idle rotation
  float: 0, // gentle bobbing
  sway: 0, // slow side-to-side rotation
  tab: 0,
  mouth: 0,
  burst: 0,
  frost: 0,
  ice: 0,
  shadow: 0,
  bubbles: 0,
};

export class Experience {
  constructor(canvas, { flavor, reducedMotion = false, isMobile = false }) {
    this.canvas = canvas;
    this.flavor = flavor;
    this.reducedMotion = reducedMotion;
    this.isMobile = isMobile;

    // Starts below the fold; the intro animation flies it in.
    this.state = { ...BASE_STATE, y: -2, scale: 0.75, ry: -Math.PI * 1.5, rz: 0.5 };
    this.spinAngle = 0;
    this.flavorSpin = 0;
    this.pulse = 1;
    this.time = 0;
    this.fitScale = 1;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.wasVisible = true;
    this.beforeRender = null; // set by the scroll choreography
  }

  async init(onProgress = () => {}) {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.75 : 2);
    renderer.setPixelRatio(this.pixelRatio);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    this.scene.environment = createStudioEnvironment(renderer);
    onProgress(0.2);
    await nextFrame();

    const labelSize = Math.min(this.isMobile ? 1024 : 2048, renderer.capabilities.maxTextureSize);
    this.can = new Can({ renderer, flavor: this.flavor, labelSize });
    this.scene.add(this.can.root);
    onProgress(0.55);
    await nextFrame();

    this.bubbles = new Bubbles({ count: this.isMobile ? 320 : 700, pixelRatio: this.pixelRatio });
    this.scene.add(this.bubbles.points);

    this.burst = new Burst({ count: this.isMobile ? 240 : 420, pixelRatio: this.pixelRatio });
    this.burst.points.position.copy(MOUTH_CENTER);
    this.can.model.add(this.burst.points);

    this.ice = new IceCubes();
    this.scene.add(this.ice.group);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
        toneMapped: false,
      }),
    );
    this.shadow.position.z = -1.2;
    this.scene.add(this.shadow);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (!this.reducedMotion && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('pointermove', (e) => {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      });
    }

    // Compile every shader up front (including the hidden ice and mouth)
    this.ice.group.visible = true;
    this.can.mouth.visible = true;
    this.burst.points.visible = true;
    await renderer.compileAsync(this.scene, this.camera);
    this.ice.group.visible = false;
    this.can.mouth.visible = false;
    this.burst.points.visible = false;
    onProgress(0.9);
    await nextFrame();

    this.tick = this.tick.bind(this);
    this.tick(0, 16);
    gsap.ticker.add(this.tick);
    onProgress(1);
  }

  // Paint the other flavors' labels when the browser is idle.
  prepareFlavors(flavors) {
    const queue = flavors.filter((f) => f.id !== this.flavor.id);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const next = () => {
      const flavor = queue.shift();
      if (!flavor) return;
      this.can.prepare(flavor);
      idle(next);
    };
    idle(next);
  }

  switchFlavor(flavor, direction = 1) {
    this.flavor = flavor;
    if (this.reducedMotion) {
      this.can.setFlavor(flavor);
      return;
    }
    gsap.to(this, {
      flavorSpin: Math.round(this.flavorSpin / TAU) * TAU + direction * TAU,
      duration: 1.2,
      ease: 'power3.inOut',
      overwrite: true,
    });
    gsap.to(this, { pulse: 0.86, duration: 0.5, ease: 'power2.in', yoyo: true, repeat: 1 });
    // Swap the artwork mid-spin, while the back of the can faces us.
    gsap.delayedCall(0.55, () => this.can.setFlavor(flavor));
  }

  setBubbleColor(hex) {
    const target = new THREE.Color(hex);
    for (const material of [this.bubbles.material, this.burst.material]) {
      gsap.to(material.uniforms.uColor.value, { r: target.r, g: target.g, b: target.b, duration: 0.8 });
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    this.viewWidth = this.viewHeight * this.camera.aspect;
    // Keep the can comfortably inside narrow (portrait) viewports
    this.fitScale = Math.min(1, this.viewWidth / 4.2);
  }

  tick(_time, deltaMS) {
    const realDt = Math.min((deltaMS || 16) / 1000, 0.25);
    const dt = Math.min(realDt, 1 / 20);
    this.beforeRender?.();
    const s = this.state;
    const motion = this.reducedMotion ? 0 : 1;
    this.time += dt * motion;
    const t = this.time;

    // Pointer parallax, eased
    const ease = Math.min(1, dt * 4);
    this.pointer.sx += (this.pointer.x - this.pointer.sx) * ease;
    this.pointer.sy += (this.pointer.y - this.pointer.sy) * ease;

    // Idle spin; as it fades out, settle on the nearest full turn so the
    // front of the can faces the camera again.
    this.spinAngle += dt * 0.65 * s.spin * motion;
    const settle = 1 - s.spin;
    if (settle > 0) {
      const target = Math.round(this.spinAngle / TAU) * TAU;
      this.spinAngle += (target - this.spinAngle) * (1 - Math.exp(-realDt * 4 * settle));
    }

    const bob = Math.sin(t * 1.3) * 0.08 * s.float;
    const scale = s.scale * this.fitScale * this.pulse;
    const root = this.can.root;
    root.position.set(s.x * this.viewWidth * 0.5 + this.pointer.sx * 0.15, s.y * this.viewHeight * 0.5 + bob, 0);
    root.rotation.set(
      s.rx + this.pointer.sy * 0.14 + Math.sin(t * 0.9) * 0.03 * s.float,
      0,
      s.rz + Math.sin(t * 0.7) * 0.035 * s.float - this.pointer.sx * 0.05,
    );
    root.scale.setScalar(scale);
    this.can.spin.rotation.y =
      s.ry + this.spinAngle + this.flavorSpin + this.pointer.sx * 0.3 + Math.sin(t * 0.55) * 0.32 * s.sway;

    this.can.setTab(s.tab);
    this.can.setMouth(s.mouth);
    this.can.setFrost(s.frost);
    this.burst.update(s.burst);
    this.bubbles.update(t, s.bubbles);
    this.ice.update(t, dt * motion, s.ice, root.position, scale);

    // Soft contact shadow under the can
    const bottom = root.position.y - (CAN.height / 2) * scale;
    this.shadow.position.x = root.position.x + Math.sin(root.rotation.z) * (CAN.height / 2) * scale;
    this.shadow.position.y = bottom - 0.2 * scale - bob * 0.5;
    this.shadow.scale.set(2.8 * scale * (1 - bob), 0.55 * scale, 1);
    this.shadow.material.opacity = s.shadow * Math.max(0, 1 - Math.abs(s.rx) * 1.5) * (1 - bob * 3);
    this.shadow.visible = this.shadow.material.opacity > 0.002;

    // Skip rendering while the can is off screen and nothing else is visible
    const onScreen = Math.abs(root.position.y) < this.viewHeight * 0.5 + CAN.height * scale || s.bubbles > 0.002;
    if (onScreen || this.wasVisible) this.renderer.render(this.scene, this.camera);
    this.wasVisible = onScreen;
  }
}
