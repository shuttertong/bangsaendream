// Post-processing (CLAUDE.md §5.3): MSAA HalfFloat target → RenderPass → GTAO (reduced
// resolution) → OutputPass (tone map + sRGB) → colour grade → optional tilt-shift.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { ATMOS } from '../shared/palette.js';

const AO_SCALE = 0.5;

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: ATMOS.gradeSaturation },
    lift: { value: ATMOS.gradeLift },
    warm: { value: ATMOS.gradeWarm },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation, lift, warm;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = c.rgb * (1.0 - lift) + lift * vec3(0.96, 0.98, 1.0);   // lift darks, slightly cool
      c.rgb += warm * vec3(1.0, 0.45, -0.3) * (1.0 - l) * l * 4.0;     // warm the mid-tones
      gl_FragColor = c;
    }`,
};

export function createPostFX(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(size.x, size.y),
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, size.x * AO_SCALE, size.y * AO_SCALE);
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSetSize(Math.ceil(w * AO_SCALE), Math.ceil(h * AO_SCALE));
  composer.addPass(gtao);

  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // miniature look, only for the overhead/map view
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.enabled = tiltV.enabled = false;
  composer.addPass(tiltH);
  composer.addPass(tiltV);

  function setSize(w, h) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    const px = renderer.getDrawingBufferSize(new THREE.Vector2());
    tiltH.uniforms.h.value = 2.2 / px.x;
    tiltV.uniforms.v.value = 2.2 / px.y;
  }
  setSize(innerWidth, innerHeight);

  function setTiltShift(on, focusY = 0.5) {
    tiltH.enabled = tiltV.enabled = on;
    tiltH.uniforms.r.value = tiltV.uniforms.r.value = focusY;
  }

  return { composer, gtao, grade, setSize, setTiltShift, render: dt => composer.render(dt) };
}
