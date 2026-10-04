import * as THREE from 'three';
import { IceCubes } from './IceCubes.js';
import { fresnelGlass } from './materials.js';
import { createFoamTexture, seeded } from './textures.js';

// A tall highball glass in can units (the can is radius 1, 3.72 tall).
// The group's origin is the centre of the glass's base.
export const GLASS = { height: 4.6, r0: 1.05, r1: 1.25, wall: 0.07, base: 0.42 };
const FILL_MIN = GLASS.base + 0.02;
const FILL_MAX = GLASS.height * 0.86;
const LIQUID_INSET = 0.012;
const innerRadius = (y) => THREE.MathUtils.lerp(GLASS.r0 - GLASS.wall, GLASS.r1 - GLASS.wall, y / GLASS.height);

export class Glass {
  constructor({ pixelRatio = 1, bubbleCount = 300 } = {}) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.level = { value: FILL_MIN }; // shared by the liquid and bubble shaders
    this.createGlass();
    this.createLiquid();
    this.createFoam();
    this.createWallBubbles(pixelRatio, bubbleCount);
    this.ice = new IceCubes();
    this.group.add(this.ice.group);
  }

  createGlass() {
    const { height: H, r0, r1, wall, base } = GLASS;
    const rb = innerRadius(base);
    // Outer wall up, over the rim, inner wall down, across the thick base
    const p = new THREE.Path();
    p.moveTo(0, 0);
    p.lineTo(r0 - 0.06, 0);
    p.quadraticCurveTo(r0, 0, r0, 0.06);
    p.lineTo(r1, H - 0.025);
    p.quadraticCurveTo(r1, H, r1 - 0.025, H);
    p.lineTo(r1 - wall + 0.02, H);
    p.quadraticCurveTo(r1 - wall, H, r1 - wall, H - 0.025);
    p.lineTo(rb, base + 0.08);
    p.quadraticCurveTo(rb, base, rb - 0.08, base);
    p.lineTo(0, base);
    this.glass = new THREE.Mesh(
      new THREE.LatheGeometry(p.getSpacedPoints(220), 96),
      fresnelGlass({ color: 0xe2ecf2, center: 0.05, edge: 0.62, power: 2.2, glint: 0.8, envMapIntensity: 2.2 }),
    );
    this.glass.renderOrder = 3; // drawn last, over everything inside it
    this.group.add(this.glass);
  }

  createLiquid() {
    // The full column of cola; fragments above the fill level are discarded.
    const y0 = GLASS.base + 0.004;
    const top = GLASS.height * 0.97;
    const pts = [new THREE.Vector2(0, y0), new THREE.Vector2(innerRadius(y0) - LIQUID_INSET - 0.05, y0)];
    for (let i = 0; i <= 40; i++) {
      const y = y0 + 0.05 + (top - y0 - 0.05) * (i / 40);
      pts.push(new THREE.Vector2(innerRadius(y) - LIQUID_INSET, y));
    }
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x2a0c05,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLevel = this.level;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLiquidY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLiquidY = transformed.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLiquidY;\nuniform float uLevel;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLiquidY > uLevel) discard;')
        // Light glowing amber through the thin edges, like backlit cola
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.36, 0.09, 0.02) * pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);`,
        );
    };
    this.liquid = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), material);
    this.group.add(this.liquid);

    const surface = new THREE.CircleGeometry(1, 64);
    surface.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(
      surface,
      new THREE.MeshPhysicalMaterial({ color: 0x1d0803, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }),
    );
    this.group.add(this.surface);
  }

  createFoam() {
    this.foam = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 64, 1, false),
      new THREE.MeshStandardMaterial({ map: createFoamTexture(), roughness: 0.92, metalness: 0 }),
    );
    this.group.add(this.foam);
  }

  // Bubbles clinging to the inside of the glass and drifting up through the
  // drink, between the cola and the glass wall on the side facing us.
  createWallBubbles(pixelRatio, count) {
    const rand = seeded(23);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = (rand() * 2 - 1) * 1.3; // angle around the glass
      data[i * 4 + 1] = rand(); // start height
      data[i * 4 + 2] = 0.04 + rand() * 0.3; // rise speed
      data[i * 4 + 3] = 0.35 + Math.pow(rand(), 2.5) * 1.3; // size
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aBubble', new THREE.BufferAttribute(data, 4));
    const { height: H, r0, r1, wall, base } = GLASS;
    this.bubbles = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLevel: this.level,
          uPixelRatio: { value: pixelRatio },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uLevel;
          uniform float uPixelRatio;
          attribute vec4 aBubble;
          varying float vAlpha;
          void main() {
            float bottom = ${(base + 0.05).toFixed(3)};
            float span = max(uLevel - bottom - 0.05, 0.001);
            float y = bottom + mod(aBubble.y * span + uTime * aBubble.z, span);
            float r = mix(${(r0 - wall).toFixed(3)}, ${(r1 - wall).toFixed(3)}, y / ${H.toFixed(2)}) - 0.006;
            vec4 mv = modelViewMatrix * vec4(sin(aBubble.x) * r, y, cos(aBubble.x) * r, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = 34.0 * aBubble.w * uPixelRatio / -mv.z;
            vAlpha = smoothstep(0.0, 0.12, uLevel - y) * (0.55 + 0.45 * cos(aBubble.x));
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float rim = smoothstep(0.25, 0.45, d) * (1.0 - smoothstep(0.45, 0.5, d));
            float glint = 1.0 - smoothstep(0.0, 0.14, length(uv - vec2(-0.14, -0.14)));
            gl_FragColor = vec4(vec3(1.0, 0.86, 0.72), (rim * 0.8 + glint) * vAlpha);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.bubbles.frustumCulled = false;
    this.bubbles.renderOrder = 1;
    this.group.add(this.bubbles);
  }

  get levelY() {
    return this.level.value;
  }

  update({ time, dt, x, y, scale, show, fill, foam, ice }) {
    this.group.visible = show > 0.001;
    if (!this.group.visible) return;
    const rise = 1 - Math.pow(1 - show, 3);
    this.group.position.set(x, y - (GLASS.height / 2) * scale - (1 - rise) * 7, -0.4);
    this.group.scale.setScalar(scale);

    const level = THREE.MathUtils.lerp(FILL_MIN, FILL_MAX, fill);
    const hasLiquid = fill > 0.002;
    this.level.value = level;
    this.liquid.visible = this.surface.visible = this.bubbles.visible = hasLiquid;
    const r = innerRadius(level) - LIQUID_INSET;
    this.surface.position.y = level;
    this.surface.scale.setScalar(r);

    const foamHeight = 0.38 * foam;
    this.foam.visible = hasLiquid && foamHeight > 0.004;
    this.foam.scale.set(r, foamHeight, r);
    this.foam.position.y = level + foamHeight / 2;

    this.bubbles.material.uniforms.uTime.value = time;
    this.ice.update(time, dt, ice, level + foamHeight * 0.5, hasLiquid);
  }

  // Where the stream should land: the middle of the drink's surface.
  surfacePoint(target, offsetX = 0) {
    return this.group.localToWorld(target.set(offsetX, this.level.value, 0.05));
  }

  get opening() {
    return { x: this.group.position.x, halfWidth: (GLASS.r1 - GLASS.wall - 0.2) * this.group.scale.x };
  }
}
