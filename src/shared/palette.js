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

  sand: '#eee2c6',                 // Bang Saen's pale, fine sand
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

// Building colour sets (picked per row / per unit)
export const BUILDING = {
  walls: ['#eee3cc', '#e6dcc4', '#cfe3d4', '#d9ecdf', '#f1d6d2', '#eed9c4', '#dfe4ea', '#f3ead2', '#e9d3b0'],
  houseWalls: ['#f2ebdc', '#e8e0cf', '#dde6d6', '#f0dccb', '#e4d4bd'],
  trim: ['#f7f3ea', '#d8d0c0', '#bfb6a6'],
  awnings: ['#3f7fb5', '#2f8f78', '#c9573f', '#d69a3a', '#6d8fa6', '#9a5a8a', '#e0dcd2'],
  signs: ['#c94a3a', '#2f6fa8', '#e5b23a', '#3c8a5a', '#f0ebe0', '#d9723a', '#6a4f9a'],
  shutter: '#9aa0a3',
  goods: ['#e8443a', '#f0c23a', '#3f8fd0', '#46b36a', '#f07fa8', '#f4f1e8', '#e08a3a'],
  interior: '#8c7b66',
  tileRoofs: ['#b8583a', '#a44e36', '#c06a42', '#8f4a3a'],
  metalRoofs: ['#8d9aa3', '#9aa7a0', '#a36f52', '#7d8e9c', '#b0b4b0'],
  glass: '#4d6470',
  frame: '#e9e6df',
  rail: '#d8d6d0',
  concrete: '#c4bfb4',
  spirit: ['#d4a94a', '#e8e0d0', '#c9463a'],
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
