// The player kid (≈1.3 m): straw hat, T-shirt, shorts, sandals. Built by the shared
// person builder; bones are posed by kid/index.js.
import { buildPerson, BODY } from '../people/body.js';

export const KID = BODY;
export const KID_LOOK = {
  shirt: '#7fc4e8', bottom: 'shorts', bottomColor: '#34507a', hat: 'straw',
};

export const buildKid = (look = KID_LOOK) => buildPerson(look);
