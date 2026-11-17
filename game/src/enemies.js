// Enemies: chasers, brutes, spitters and the boss. Spawning, AI, projectiles.
import { ENEMIES, BOSS_HP_PER_WAVE, ARENA } from './config.js';
import { clamp, angleTo, dist2 } from './utils.js';

let nextId = 1;

export function makeEnemy(type, x, y, wave) {
  const def = ENEMIES[type];
  const scale = 1 + (wave - 1) * 0.09;
  const isBoss = type === 'boss';
  return {
    id: nextId += 1,
    type, x, y, radius: def.radius,
    hp: isBoss ? def.hp + BOSS_HP_PER_WAVE * wave : def.hp * scale,
    maxHp: isBoss ? def.hp + BOSS_HP_PER_WAVE * wave : def.hp * scale,
    speed: def.speed * (1 + Math.min(0.5, (wave - 1) * 0.03)),
    damage: def.damage,
    shards: def.shards,
    score: def.score,
    flash: 0, shootCd: 2 + Math.random(),
    // Boss state
    attackCd: 3, attack: null, attackT: 0, vx: 0, vy: 0, summonCd: 6,
  };
}

export function spawnPoint(rng) {
  // Just outside a random arena edge.
  const side = Math.floor(rng() * 4);
  const m = 30;
  if (side === 0) return { x: ARENA.x + rng() * ARENA.w, y: ARENA.y - m };
  if (side === 1) return { x: ARENA.x + rng() * ARENA.w, y: ARENA.y + ARENA.h + m };
  if (side === 2) return { x: ARENA.x - m, y: ARENA.y + rng() * ARENA.h };
  return { x: ARENA.x + ARENA.w + m, y: ARENA.y + rng() * ARENA.h };
}

// Enemy step: chase the player; spitters keep distance and shoot; boss runs attack patterns.
// Returns enemy projectiles created this step.
export function stepEnemy(e, px, py, dt, rng) {
  const orbs = [];
  e.flash = Math.max(0, e.flash - dt);
  const d2 = dist2(e.x, e.y, px, py);
  const d = Math.sqrt(d2) || 1;
  const ang = angleTo(e.x, e.y, px, py);

  if (e.type === 'boss') {
    stepBoss(e, px, py, d, ang, dt, rng, orbs);
    return orbs;
  }
  if (e.type === 'spitter') {
    // Keep ~260px away and shoot.
    const want = 260;
    const dir = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
    e.x += Math.cos(ang) * e.speed * dir * dt;
    e.y += Math.sin(ang) * e.speed * dir * dt;
    // Strafe a little so they do not stack.
    e.x += Math.cos(ang + Math.PI / 2) * e.speed * 0.3 * dt;
    e.y += Math.sin(ang + Math.PI / 2) * e.speed * 0.3 * dt;
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 520) {
      e.shootCd = 2.4;
      orbs.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, r: 7, damage: e.damage, life: 4, color: '#7dff6a' });
    }
  } else {
    // Chaser / brute: straight at the player, slight wobble so they separate.
    const wob = Math.sin((e.id * 1.7 + performance.now() / 700)) * 0.25;
    const a = ang + wob;
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;
  }
  e.x = clamp(e.x, ARENA.x - 40, ARENA.x + ARENA.w + 40);
  e.y = clamp(e.y, ARENA.y - 40, ARENA.y + ARENA.h + 40);
  return orbs;
}

function stepBoss(e, px, py, d, ang, dt, rng, orbs) {
  e.attackCd -= dt;
  e.summonCd -= dt;
  if (e.attack) {
    e.attackT -= dt;
    if (e.attack === 'charge') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, ARENA.x + e.radius, ARENA.x + ARENA.w - e.radius);
      e.y = clamp(e.y, ARENA.y + e.radius, ARENA.y + ARENA.h - e.radius);
    }
    if (e.attackT <= 0) e.attack = null;
    return;
  }
  // Drift toward the player slowly.
  e.x += Math.cos(ang) * e.speed * dt;
  e.y += Math.sin(ang) * e.speed * dt;
  if (e.attackCd <= 0) {
    const roll = rng();
    if (roll < 0.45) {
      // Radial burst.
      e.attack = 'radial';
      e.attackT = 0.4;
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2;
        orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 8, damage: 14, life: 5, color: '#c44dff' });
      }
      e.attackCd = 3.2;
    } else if (roll < 0.8 && d > 120) {
      // Telegraph then charge.
      e.attack = 'charge';
      e.attackT = 0.7;
      e.vx = Math.cos(ang) * 560;
      e.vy = Math.sin(ang) * 560;
      e.attackCd = 3.6;
    } else {
      e.attack = 'summon';
      e.attackT = 0.3;
      e.attackCd = 4.5;
    }
  }
}
