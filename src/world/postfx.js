// Post-processing (CLAUDE.md §5.3): MSAA HalfFloat target → RenderPass → GTAO (reduced
// resolution) → OutputPass (tone map + sRGB + the colour grade, in one pass) → optional tilt-shift.
// The picture-quality level (core/quality.js) sets the MSAA samples and whether GTAO runs; it is read
// again on every setSize(), which the quality watcher triggers through a window 'resize'.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { ATMOS } from '../shared/palette.js';
import { QUALITY } from '../shared/config.js';
import { gfx } from '../core/quality.js';

const AO_SCALE = 0.5;
const AO_RANGE = 160, AO_MAX_HEIGHT = 350;   // AO only near the focus; off from high up

// the colour grade, on the sRGB picture: a little less saturation, lifted darks, warm mid-tones
const GRADE = /* glsl */`
  {
    vec4 c = gl_FragColor;
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb = mix(vec3(l), c.rgb, saturation);
    c.rgb = c.rgb * (1.0 - lift) + lift * vec3(0.96, 0.98, 1.0);   // lift darks, slightly cool
    c.rgb += warm * vec3(1.0, 0.45, -0.3) * (1.0 - l) * l * 4.0;     // warm the mid-tones
    gl_FragColor = c;
  }
`;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: ATMOS.gradeSaturation }, lift: { value: ATMOS.gradeLift }, warm: { value: ATMOS.gradeWarm } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation, lift, warm;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(tDiffuse, vUv);${GRADE}}`,
};
/** MSAA samples for the level at this pixel ratio (a dense screen needs fewer). */
const samplesFor = ratio => (ratio >= QUALITY.hiDpi.ratio ? Math.min(gfx.L.msaa, QUALITY.hiDpi.msaa) : gfx.L.msaa);

export function createPostFX(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, samples: samplesFor(renderer.getPixelRatio()), depthTexture: new THREE.DepthTexture(size.x, size.y),
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, size.x * AO_SCALE, size.y * AO_SCALE);
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  // reuse the main pass's depth (normals rebuilt from it) instead of re-rendering the scene
  gtao.setGBuffer(target.depthTexture);
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSetSize(Math.ceil(w * AO_SCALE), Math.ceil(h * AO_SCALE));
  composer.addPass(gtao);

  // tone mapping, sRGB and the grade in one full-screen pass: the grade is written into three's output shader
  // (if that shader ever changes shape, the grade falls back to a pass of its own)
  const output = new OutputPass();
  composer.addPass(output);
  const src = output.material.fragmentShader, at = src.lastIndexOf('}');
  let grade;
  if (src.includes('uniform sampler2D tDiffuse;') && at > 0) {
    output.material.fragmentShader = `${src.slice(0, at)}${GRADE}}`.replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform float saturation, lift, warm;');
    Object.assign(output.uniforms, { saturation: { value: ATMOS.gradeSaturation }, lift: { value: ATMOS.gradeLift }, warm: { value: ATMOS.gradeWarm } });
    grade = output;
  } else {
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
  }

  // miniature look, only for the overhead/map view
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.enabled = tiltV.enabled = false;
  composer.addPass(tiltH);
  composer.addPass(tiltV);

  let aoOn = true, aoSamples = 12;
  function setSize(w, h) {
    // the quality level: MSAA samples (the targets are made again at the new count) and ambient occlusion
    const samples = samplesFor(renderer.getPixelRatio());
    for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== samples) { t.samples = samples; t.dispose(); }
    aoOn = gfx.L.ao > 0;
    if (aoOn && gfx.L.ao !== aoSamples) { aoSamples = gfx.L.ao; gtao.updateGtaoMaterial({ samples: aoSamples }); gtao.updatePdMaterial({ samples: aoSamples }); }
    if (!aoOn) gtao.enabled = false;
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

  // AO is a close-up effect; far away the depth-rebuilt normals just make streaks
  const box = new THREE.Box3();
  function setFocus(p, camHeight) {
    gtao.enabled = aoOn && camHeight < AO_MAX_HEIGHT;
    box.min.set(p.x - AO_RANGE, p.y - 60, p.z - AO_RANGE);
    box.max.set(p.x + AO_RANGE, p.y + 80, p.z + AO_RANGE);
    gtao.setSceneClipBox(box);
  }

  function render(dt) {
    // the composer swaps its two targets; point GTAO at the depth the RenderPass is about to write
    const depth = composer.readBuffer.depthTexture;
    gtao.gtaoMaterial.uniforms.tDepth.value = gtao.pdMaterial.uniforms.tDepth.value = depth;
    composer.render(dt);
  }

  return { composer, gtao, grade, setSize, setTiltShift, setFocus, render };
}
