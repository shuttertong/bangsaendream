// The player kid (≈1.35 m, chibi proportions): straw hat, T-shirt, shorts, sandals. Built by the shared
// person builder; bones are posed by kid/index.js.
import { buildPerson } from '../people/body.js';

export const KID_LOOK = {
  shirt: '#7fc4e8', bottom: 'shorts', bottomColor: '#34507a', hat: 'straw',
  headScale: 1.28, bag: '#e8958a',            // a slightly bigger head than the other kids'; a little backpack
};

export const buildKid = (look = KID_LOOK) => buildPerson(look);
