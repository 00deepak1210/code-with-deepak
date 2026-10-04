import * as THREE from 'three';

// Real transmission samples a white-cleared buffer on our transparent canvas
// and turns milky, so glass and ice are faked instead: see-through where the
// surface faces the camera, denser and more reflective towards the edges
// (Fresnel), with bright reflections kept opaque.
export function fresnelGlass({ color, center = 0.14, edge = 0.88, power = 1.5, glint = 0.6, envMapIntensity = 1.8 }) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.05,
    ior: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    envMapIntensity,
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float facing = abs(dot(normalize(vViewPosition), normal));
      float rim = pow(1.0 - facing, ${power.toFixed(2)});
      float shine = smoothstep(0.65, 1.0, dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
      gl_FragColor.a = clamp(mix(${center.toFixed(3)}, ${edge.toFixed(3)}, rim) + shine * ${glint.toFixed(2)}, 0.0, 1.0);`,
    );
  };
  // Distinct cache keys, since the injected numbers differ per material
  material.customProgramCacheKey = () => `fresnel-${center}-${edge}-${power}-${glint}`;
  return material;
}
