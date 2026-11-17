// Between-wave upgrade cards: draw 3 distinct cards from the pool.
import { UPGRADE_POOL } from './config.js';
import { shuffle } from './utils.js';

export function drawCards(rng, ownedWeapons) {
  const pool = UPGRADE_POOL.filter((c) => {
    if (c.kind === 'weapon') return !ownedWeapons[c.stat];
    if (c.id === 'pierce') return true; // idempotent, harmless to repeat
    return true;
  });
  return shuffle(pool.slice(), rng).slice(0, 3);
}

// Card layout for the upgrade screen (3 cards across the arena).
export function cardRects() {
  const w = 300;
  const h = 210;
  const gap = 40;
  const total = w * 3 + gap * 2;
  const x0 = 640 - total / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}
