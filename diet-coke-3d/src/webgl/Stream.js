import * as THREE from 'three';

const _p1 = new THREE.Vector3();

// The stream of cola pouring from the can into the glass. The tube is built
// in the vertex shader along a quadratic Bézier curve (a parabola, like a
// real falling stream) whose end points are updated every frame, so it
// follows the can and the glass wherever the scroll choreography moves them.
export class Stream {
  constructor() {
    const radial = 12;
    const segments = 72;
    const t = [];
    const a = [];
    const index = [];
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= radial; j++) {
        t.push(i / segments);
        a.push((j / radial) * Math.PI * 2);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const p = i * (radial + 1) + j;
        const q = p + radial + 1;
        index.push(p, q, p + 1, q, q + 1, p + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(t.length * 3), 3));
    geometry.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    geometry.setAttribute('aAngle', new THREE.Float32BufferAttribute(a, 1));
    geometry.setIndex(index);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uP0: { value: new THREE.Vector3() },
        uP1: { value: new THREE.Vector3() },
        uP2: { value: new THREE.Vector3() },
        uRadius: { value: 0.1 },
        uHead: { value: 0 },
        uTail: { value: 0 },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#2a0c05') },
        uRim: { value: new THREE.Color('#9a3a16') },
      },
      vertexShader: /* glsl */ `
        uniform vec3 uP0;
        uniform vec3 uP1;
        uniform vec3 uP2;
        uniform float uRadius;
        uniform float uTime;
        attribute float aT;
        attribute float aAngle;
        varying float vT;
        varying vec3 vNormal;
        varying vec3 vView;

        vec3 curve(float t) {
          float u = 1.0 - t;
          return u * u * uP0 + 2.0 * u * t * uP1 + t * t * uP2;
        }

        void main() {
          vT = aT;
          vec3 c = curve(aT);
          vec3 tangent = normalize(2.0 * (1.0 - aT) * (uP1 - uP0) + 2.0 * aT * (uP2 - uP1));
          vec3 side = normalize(cross(tangent, vec3(0.0, 0.0, 1.0)));
          vec3 up = cross(side, tangent);
          // Thins as it accelerates, with a little ripple running down it
          float r = uRadius * mix(1.0, 0.55, aT) * (1.0 + 0.1 * sin(aT * 46.0 - uTime * 22.0));
          vec3 n = side * cos(aAngle) + up * sin(aAngle);
          vec4 mv = viewMatrix * vec4(c + n * r, 1.0);
          vNormal = normalize(mat3(viewMatrix) * n);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uHead;
        uniform float uTail;
        uniform vec3 uColor;
        uniform vec3 uRim;
        varying float vT;
        varying vec3 vNormal;
        varying vec3 vView;

        void main() {
          if (vT > uHead || vT < uTail) discard;
          vec3 n = normalize(vNormal);
          float facing = abs(dot(n, vView));
          float rim = pow(1.0 - facing, 2.0);
          vec3 r = reflect(-vView, n);
          float spec = pow(max(dot(r, normalize(vec3(-0.5, 0.5, 0.7))), 0.0), 18.0);
          float streak = smoothstep(0.82, 0.98, facing) * 0.25;
          vec3 color = mix(uColor, uRim, rim * 0.85) + vec3(spec * 0.9 + streak);
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
  }

  // from: pour lip (world), to: landing point on the drink (world)
  update({ from, to, head, tail, radius, time }) {
    this.mesh.visible = head > 0.001 && tail < 0.999;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    u.uP0.value.copy(from);
    u.uP2.value.copy(to);
    // Leaves the lip moving sideways, then falls straight into the glass
    u.uP1.value.copy(_p1.set(to.x, from.y + radius * 0.6, (from.z + to.z) / 2));
    u.uRadius.value = radius;
    u.uHead.value = head;
    u.uTail.value = tail;
    u.uTime.value = time;
  }
}
