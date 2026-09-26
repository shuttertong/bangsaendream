// Bang Saen palette (CLAUDE.md §5.10). Tune colours here, not in logic.
export const PALETTE = {
  sun: '#fff1d6',
  sunIntensity: 3.4,
  sunDir: [0.42, 0.78, 0.46],
  hemiSky: '#c4dcf5',
  hemiGround: '#8f8a6a',
  hemiIntensity: 1.0,

  skyZenith: '#2f78c8',
  skyHorizon: '#cfe6f2',
  haze: '#d2e2ea',
  hazeSun: '#fbe9cf',        // haze tint toward the sun

  sand: '#e8d8a8',
  wetSand: '#cdbb8a',
  seabed: '#b9a77a',
  lowland: '#8aa65a',
  lowlandDry: '#a8a868',
  hill: '#4f7236',
  rock: '#8a8272',

  seaShallow: '#4fb3a8',
  seaMid: '#2a8f9a',
  seaDeep: '#1d5f7a',
  foam: '#f4f7f2',

  casuarina: '#4d6e3c',
  palm: '#4f8a3a',
  metalRoof: '#8d9aa3',
  tileRoof: '#b8583a',
  wallCream: '#eee3cc',
};

// Atmosphere and grading numbers live next to the colours.
export const ATMOS = {
  fogDensity: 0.00055,       // base FogExp2 density at the ground
  hazeHeight: 60,            // e-folding height of the haze layer (scene units)
  exposure: 1.05,
  gradeSaturation: 0.92,
  gradeLift: 0.035,
  gradeWarm: 0.02,
};
