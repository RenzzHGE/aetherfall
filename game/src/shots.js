// Screenshot staging: ?shot=title|combat|upgrade|boss paints a representative scene
// and sets window.__shotReady so the capture script knows the frame is ready.
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE } from './render.js';
import { makeEnemy } from './enemies.js';
import { burst } from './particles.js';
import { drawCards } from './upgrades.js';
import { startWave } from './world.js';

export function stageShot(name, world) {
  const w = world;
  if (name === 'title') {
    // A few enemies drifting in the arena behind the title.
    for (let i = 0; i < 5; i += 1) {
      const e = makeEnemy(i % 3 === 0 ? 'brute' : 'chaser', 200 + i * 180, 180 + (i % 2) * 260, 1);
      w.enemies.push(e);
    }
    return { screen: SCREEN_TITLE, best: 12500 };
  }
  if (name === 'upgrade') {
    startWave(w, 2);
    // Clear the wave instantly so the upgrade screen shows.
    w.enemies = [];
    w.spawnQueue = [];
    w.waveState = 'upgrade';
    w.cards = drawCards(w.rng, w.player.stats.weapons);
    w.score = 2450;
    w.shardCount = 18;
    return { screen: SCREEN_UPGRADE, best: 12500 };
  }
  if (name === 'boss') {
    startWave(w, 5);
    w.score = 18200;
    w.kills = 96;
    w.combo = 12;
    // Pull the boss into view for the shot (it spawns just outside an edge).
    if (w.boss) {
      w.boss.x = 920;
      w.boss.y = 430;
      w.boss.hp = w.boss.maxHp * 0.62;
    }
    // A few minions around the boss.
    const m1 = makeEnemy('chaser', 700, 300, 5);
    const m2 = makeEnemy('spitter', 1080, 260, 5);
    w.enemies.push(m1, m2);
    burst(w.fx, 640, 300, '#c44dff', 30, 320);
    burst(w.fx, 500, 420, '#ffd166', 20, 260);
    return { screen: SCREEN_PLAY, best: 12500 };
  }
  // combat (default): mid-fight, wave 3, particles + combo.
  startWave(w, 3);
  w.score = 7300;
  w.kills = 41;
  w.combo = 8;
  w.comboT = 2.0;
  for (let i = 0; i < 4; i += 1) {
    const e = makeEnemy(i === 0 ? 'brute' : 'chaser', 300 + i * 160, 220 + (i % 2) * 200, 3);
    w.enemies.push(e);
  }
  burst(w.fx, 520, 320, '#ff4fd8', 24, 300);
  burst(w.fx, 760, 400, '#ffd166', 18, 240);
  return { screen: SCREEN_PLAY, best: 12500 };
}
