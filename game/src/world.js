// World: the whole game state — waves, spawning, bullets, collisions, score, combo.
import { ARENA, STEP, PLAYER, waveComp, isBossWave } from './config.js';
import { createPlayer, resetPlayer, currentWeapon, stepPlayer, clampToArena, hurtPlayer, healOnKill } from './player.js';
import { makeEnemy, spawnPoint, stepEnemy } from './enemies.js';
import { drawCards } from './upgrades.js';
import { createFx, burst, floatText, addShake, slowMo, stepFx } from './particles.js';
import { dist2 } from './utils.js';

export const EVENT_OVER = 1;
export const EVENT_WAVE_CLEAR = 2;
export const EVENT_BOSS_DIE = 4;
export const EVENT_HURT = 8;

export function createWorld(rng) {
  const player = createPlayer();
  return {
    rng,
    player,
    fx: createFx(),
    enemies: [],
    bullets: [],
    orbs: [],
    shards: [],
    wave: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboT: 0,
    comboBest: 0,
    shardCount: 0,
    spawnQueue: [],
    spawnT: 0,
    waveState: 'idle', // idle | fighting | upgrade | banner
    bannerT: 0,
    cards: [],
    boss: null,
    time: 0,
    slowmoScale: 1,
  };
}

export function resetWorld(w) {
  const fresh = createWorld(w.rng);
  Object.keys(fresh).forEach((k) => { w[k] = fresh[k]; });
  resetPlayer(w.player);
  w.player.x = 640;
  w.player.y = 360;
}

export function startWave(w, n) {
  w.wave = n;
  w.waveState = 'fighting';
  w.spawnQueue = [];
  const comp = waveComp(n);
  for (let i = 0; i < comp.chaser; i += 1) w.spawnQueue.push('chaser');
  for (let i = 0; i < comp.brute; i += 1) w.spawnQueue.push('brute');
  for (let i = 0; i < comp.spitter; i += 1) w.spawnQueue.push('spitter');
  // Shuffle the queue so the mix is not grouped.
  for (let i = w.spawnQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(w.rng() * (i + 1));
    [w.spawnQueue[i], w.spawnQueue[j]] = [w.spawnQueue[j], w.spawnQueue[i]];
  }
  if (isBossWave(n)) {
    const p = spawnPoint(w.rng);
    w.boss = makeEnemy('boss', p.x, p.y, n);
    w.enemies.push(w.boss);
  }
  w.spawnT = 0.4;
  w.bannerT = 1.6;
  w.player.shieldUp = w.player.stats.shield;
}

// Title-screen ambience: a few enemies drift around without fighting.
export function stepTitle(w, dt) {
  w.time += dt;
  if (w.enemies.length < 6 && Math.random() < 0.02) {
    const p = spawnPoint(w.rng);
    const e = makeEnemy('chaser', p.x, p.y, 1);
    w.enemies.push(e);
  }
  for (const e of w.enemies) {
    const a = Math.atan2(360 - e.y, 640 - e.x);
    e.x += Math.cos(a) * e.speed * 0.4 * dt;
    e.y += Math.sin(a) * e.speed * 0.4 * dt;
  }
  stepFx(w.fx, dt);
}

// One fixed step. Returns an event bitmask.
export function stepWorld(w, dir, aim, firing, wantDash, dt) {
  w.time += dt;
  const p = w.player;
  const fx = w.fx;
  let events = 0;

  // Slow-mo timer (boss death).
  const scale = fx.slowmo > 0 ? 0.3 : 1;
  const sdt = dt * scale;

  // Combo decay.
  w.comboT -= sdt;
  if (w.comboT <= 0 && w.combo > 0) w.combo = 0;

  // Dash.
  const dashed = stepPlayer(p, dir, aim, sdt, wantDash);
  if (dashed) burst(fx, p.x, p.y, '#7df9ff', 8, 160);
  clampToArena(p, ARENA);

  // Firing.
  const weapon = currentWeapon(p);
  if (firing && p.fireCd <= 0) {
    p.fireCd = 1 / weapon.rate;
    p.muzzle = 0.06;
    const n = weapon.projectiles;
    for (let i = 0; i < n; i += 1) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * (weapon.spread / Math.max(1, n - 1) + 0.06);
      const a = p.aimAngle + off + (Math.random() - 0.5) * 0.03;
      w.bullets.push({
        x: p.x + Math.cos(p.aimAngle) * 20, y: p.y + Math.sin(p.aimAngle) * 20,
        vx: Math.cos(a) * weapon.bulletSpeed, vy: Math.sin(a) * weapon.bulletSpeed,
        damage: weapon.damage, pierce: weapon.pierce, life: 1.4,
        r: weapon.size, color: weapon.color, hitIds: new Set(),
      });
    }
  }

  // Spawning (staggered).
  if (w.spawnQueue.length > 0) {
    w.spawnT -= sdt;
    if (w.spawnT <= 0) {
      w.spawnT = 0.35;
      const type = w.spawnQueue.shift();
      const pos = spawnPoint(w.rng);
      w.enemies.push(makeEnemy(type, pos.x, pos.y, w.wave));
    }
  }

  // Enemies.
  for (const e of w.enemies) {
    const newOrbs = stepEnemy(e, p.x, p.y, sdt, w.rng);
    for (const o of newOrbs) w.orbs.push(o);
    // Boss summon.
    if (e.type === 'boss' && e.attack === 'summon' && e.attackT > 0 && e.summonCd <= 0) {
      e.summonCd = 999;
      for (let i = 0; i < 4; i += 1) {
        const pos = spawnPoint(w.rng);
        w.enemies.push(makeEnemy('chaser', pos.x, pos.y, w.wave));
      }
      burst(fx, e.x, e.y, '#c44dff', 20, 300);
    }
  }

  // Bullets.
  for (const b of w.bullets) {
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    b.life -= sdt;
    for (const e of w.enemies) {
      if (b.hitIds.has(e.id) || e.hp <= 0) continue;
      const rr = e.radius + b.r;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        b.hitIds.add(e.id);
        e.hp -= b.damage;
        e.flash = 0.09;
        floatText(fx, e.x, e.y - e.radius - 6, String(Math.round(b.damage)), '#ffffff', 14);
        burst(fx, b.x, b.y, b.color, 4, 140);
        if (!b.pierce) { b.life = 0; break; }
      }
    }
  }
  w.bullets = w.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < 1280 && b.y > 0 && b.y < 720);

  // Enemy orbs.
  for (const o of w.orbs) {
    o.x += o.vx * sdt;
    o.y += o.vy * sdt;
    o.life -= sdt;
    const rr = p.radius + o.r;
    if (dist2(o.x, o.y, p.x, p.y) < rr * rr) {
      o.life = 0;
      const res = hurtPlayer(p, o.damage);
      if (res === 'hit') { events |= EVENT_HURT; addShake(fx, 7); burst(fx, p.x, p.y, '#ff5e78', 10, 200); }
      else if (res === 'dead') { events |= EVENT_OVER; }
    }
  }
  w.orbs = w.orbs.filter((o) => o.life > 0 && o.x > 0 && o.x < 1280 && o.y > 0 && o.y < 720);

  // Touch damage.
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    const rr = e.radius + p.radius;
    if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
      const res = hurtPlayer(p, e.damage);
      if (res === 'hit') { events |= EVENT_HURT; addShake(fx, 8); burst(fx, p.x, p.y, '#ff5e78', 12, 220); }
      else if (res === 'dead') { events |= EVENT_OVER; }
      // Push the enemy back a little so it does not stick.
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(a) * 26;
      e.y += Math.sin(a) * 26;
    }
  }

  // Deaths.
  let bossDied = false;
  for (const e of w.enemies) {
    if (e.hp <= 0) {
      const mult = 1 + Math.min(2, w.combo * 0.05);
      const gained = Math.round(e.score * mult);
      w.score += gained;
      w.kills += 1;
      w.combo += 1;
      w.comboT = 2.5;
      w.comboBest = Math.max(w.comboBest, w.combo);
      healOnKill(p);
      burst(fx, e.x, e.y, e.type === 'boss' ? '#c44dff' : '#ffd166', e.type === 'boss' ? 60 : 16, e.type === 'boss' ? 420 : 260);
      floatText(fx, e.x, e.y - 20, `+${gained}`, '#ffd166', 16);
      for (let i = 0; i < e.shards; i += 1) {
        w.shards.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, t: 0 });
      }
      if (e.type === 'boss') { bossDied = true; events |= EVENT_BOSS_DIE; slowMo(fx, 1.1); addShake(fx, 16); }
      else addShake(fx, 1.5);
    }
  }
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  if (bossDied) w.boss = null;

  // Shard pickups (magnet toward the player).
  const magnetR = PLAYER.pickupRadius * p.stats.magnetMul;
  for (const s of w.shards) {
    s.t += sdt;
    const d2 = dist2(s.x, s.y, p.x, p.y);
    if (d2 < magnetR * magnetR) {
      const d = Math.sqrt(d2) || 1;
      const pull = 520 * sdt;
      s.x += ((p.x - s.x) / d) * pull;
      s.y += ((p.y - s.y) / d) * pull;
    } else {
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;
      s.vx *= 0.9;
      s.vy *= 0.9;
    }
    if (d2 < (p.radius + 10) * (p.radius + 10)) {
      s.t = -1;
      w.shardCount += 1;
      w.score += 5;
    }
  }
  w.shards = w.shards.filter((s) => s.t >= 0);

  // Wave clear: no enemies left and nothing left to spawn.
  if (w.waveState === 'fighting' && w.enemies.length === 0 && w.spawnQueue.length === 0) {
    const bonus = 100 * w.wave;
    w.score += bonus;
    w.waveState = 'upgrade';
    w.cards = drawCards(w.rng, p.stats.weapons);
    events |= EVENT_WAVE_CLEAR;
    floatText(fx, 640, 300, `WAVE ${w.wave} CLEAR  +${bonus}`, '#7df9ff', 26);
  }

  w.bannerT = Math.max(0, w.bannerT - sdt);
  stepFx(fx, sdt);
  return events;
}

export function nextWave(w) {
  startWave(w, w.wave + 1);
}
