import * as THREE from 'three';
import { seeded } from './textures.js';

// Shared sprite: a thin bright rim, a faint body and a specular glint.
const bubbleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float rim = smoothstep(0.3, 0.46, d) * (1.0 - smoothstep(0.46, 0.5, d));
    float body = 0.1 * (1.0 - smoothstep(0.0, 0.5, d));
    float glint = 1.0 - smoothstep(0.0, 0.1, length(uv - vec2(-0.15, -0.17)));
    float a = (rim * 0.9 + body + glint * 0.85) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

// Ambient carbonation drifting up through the whole page.
export class Bubbles {
  constructor({ count = 700, pixelRatio = 1 } = {}) {
    const rand = seeded(11);
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      position[i * 3] = (rand() - 0.5) * 22;
      position[i * 3 + 1] = (rand() - 0.5) * 12;
      position[i * 3 + 2] = -9 + rand() * 11;
      seed[i * 4] = rand(); // rise speed
      seed[i * 4 + 1] = Math.pow(rand(), 2.4); // size, mostly small
      seed[i * 4 + 2] = rand(); // wobble phase
      seed[i * 4 + 3] = rand(); // wobble amount
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color('#ffffff') },
        uPixelRatio: { value: pixelRatio },
        uSize: { value: 150 },
        uHeight: { value: 12 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSize;
        uniform float uHeight;
        attribute vec4 aSeed;
        varying float vAlpha;

        void main() {
          vec3 p = position;
          float rise = uTime * (0.35 + aSeed.x * 0.9);
          p.y = mod(p.y + rise + uHeight * 0.5, uHeight) - uHeight * 0.5;
          p.x += sin(uTime * (0.8 + aSeed.w * 1.6) + aSeed.z * 6.2831) * 0.12 * (0.3 + aSeed.w);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.16 + aSeed.y) * uPixelRatio / -mv.z;
          vAlpha = smoothstep(uHeight * 0.5, uHeight * 0.36, abs(p.y));
        }
      `,
      fragmentShader: bubbleFragment,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(time, opacity) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uOpacity.value = opacity;
    this.points.visible = opacity > 0.002;
  }
}

// The spray that escapes when the can is cracked. Fully deterministic in
// time, so it can be scrubbed forwards and backwards with the scroll.
export class Burst {
  constructor({ count = 280, pixelRatio = 1 } = {}) {
    const rand = seeded(5);
    const position = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const params = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      position[i * 3] = (rand() - 0.5) * 0.32;
      position[i * 3 + 2] = (rand() - 0.5) * 0.26;
      const speed = 2.4 + rand() * 3.8;
      velocity[i * 3] = (rand() - 0.5) * 0.75 * speed;
      velocity[i * 3 + 1] = speed;
      velocity[i * 3 + 2] = (0.1 + rand() * 0.5) * speed;
      params[i * 3] = rand() * 0.9; // delay
      params[i * 3 + 1] = 0.5 + rand() * 0.8; // lifetime
      params[i * 3 + 2] = 0.3 + Math.pow(rand(), 2.5) * 1.6; // size
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocity, 3));
    geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 3));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uColor: { value: new THREE.Color('#ffffff') },
        uPixelRatio: { value: pixelRatio },
        uSize: { value: 190 },
        uGravity: { value: 6.5 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSize;
        uniform float uGravity;
        attribute vec3 aVelocity;
        attribute vec3 aParams;
        varying float vAlpha;

        void main() {
          float t = uTime - aParams.x;
          float alive = step(0.0, t) * step(t, aParams.y);
          t = max(t, 0.0);
          vec3 p = position + aVelocity * t;
          p.y -= 0.5 * uGravity * t * t;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float life = clamp(t / aParams.y, 0.0, 1.0);
          gl_PointSize = uSize * aParams.z * uPixelRatio / -mv.z * (1.0 - 0.55 * life);
          vAlpha = alive * (1.0 - life) * smoothstep(0.0, 0.05, t);
        }
      `,
      fragmentShader: bubbleFragment,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  update(progress) {
    this.material.uniforms.uTime.value = progress * 2.3;
    this.points.visible = progress > 0.001 && progress < 0.999;
  }
}
