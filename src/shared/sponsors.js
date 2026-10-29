// Who sponsors which mini-game (tier 'game' placements): town/sponsor.js fills this at load,
// shared/gameUI.js shows "สนับสนุนโดย …" on that game's intro card. Data only, no three.js.
const byGame = new Map();
export const setSponsor = (game, p) => byGame.set(game, p);
export const sponsorOf = game => byGame.get(game) || null;
