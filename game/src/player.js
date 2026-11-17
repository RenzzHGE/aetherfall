// The warden: movement, dash, weapons, firing. Stats are modified by upgrade cards.
import { PLAYER, WEAPONS } from './config.js';
import { clamp } from './utils.js';

export function createPlayer() {
  const stats = {
    damageMul: 1, rateMul: 1, speedMul: 1, dashMul: 1, magnetMul: 1,
    maxHp: PLAYER.maxHp, extraShots: 0, pierce: false, leech: 0, shield: false,
    weapons: { pulse: true, scatter: false, rail: false },
    weapon: 'pulse',
  };
  return {
    x: 640, y: 360, vx: 0, vy: 0, radius: PLAYER.radius,
    hp: PLAYER.maxHp, aimAngle: -Math.PI / 2,
    dashT: 0, dashCd: 0, invulnT: 0, shieldUp: false,
    fireCd: 0, muzzle: 0, trail: [],
    stats,
  };
}

export function resetPlayer(p) {
  const fresh = createPlayer();
  Object.assign(p, fresh);
  p.stats = fresh.stats;
}

export function applyUpgrade(p, card) {
  const s = p.stats;
  if (card.kind === 'weapon') {
    s.weapons[card.stat] = true;
    s.weapon = card.stat;
    return;
  }
  if (card.kind === 'special') {
    if (card.stat === 'pierce') s.pierce = true;
    if (card.stat === 'leech') s.leech = card.value;
    if (card.stat === 'shield') s.shield = true;
    return;
  }
  if (card.stat === 'maxHp') {
    s.maxHp += card.value;
    p.hp = Math.min(s.maxHp, p.hp + card.value);
    return;
  }
  if (card.stat === 'extraShots') { s.extraShots += card.value; return; }
  if (card.stat === 'dashMul') { s.dashMul = Math.max(0.4, s.dashMul + card.value); return; }
  s[card.stat] = (s[card.stat] ?? 1) + card.value;
}

export function currentWeapon(p) {
  const base = WEAPONS[p.stats.weapon];
  return {
    ...base,
    damage: base.damage * p.stats.damageMul,
    rate: base.rate * p.stats.rateMul,
    projectiles: base.projectiles + p.stats.extraShots,
    pierce: base.pierce || p.stats.pierce,
  };
}

export function switchWeapon(p, n) {
  const order = ['pulse', 'scatter', 'rail'];
  const id = order[n - 1];
  if (id && p.stats.weapons[id]) p.stats.weapon = id;
}

// Move + dash. Returns true if a dash started this step.
export function stepPlayer(p, dir, aim, dt, wantDash) {
  const speed = PLAYER.speed * p.stats.speedMul;
  let dashed = false;
  if (wantDash && p.dashCd <= 0 && (dir.x !== 0 || dir.y !== 0)) {
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown * p.stats.dashMul;
    p.invulnT = Math.max(p.invulnT, PLAYER.dashInvuln);
    dashed = true;
  }
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);

  const sp = p.dashT > 0 ? PLAYER.dashSpeed : speed;
  p.dashT = Math.max(0, p.dashT - dt);
  const dx = dir.x * sp * dt;
  const dy = dir.y * sp * dt;
  p.x += dx;
  p.y += dy;
  p.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);

  // Dash trail.
  p.trail.push({ x: p.x, y: p.y, t: 0.22 });
  if (p.trail.length > 14) p.trail.shift();
  for (const t of p.trail) t.t -= dt;
  p.trail = p.trail.filter((t) => t.t > 0);
  return dashed;
}

export function clampToArena(p, arena) {
  p.x = clamp(p.x, arena.x + p.radius, arena.x + arena.w - p.radius);
  p.y = clamp(p.y, arena.y + p.radius, arena.y + arena.h - p.radius);
}

// Damage the player. Returns 'blocked' | 'hit' | 'dead'.
export function hurtPlayer(p, dmg) {
  if (p.invulnT > 0) return 'blocked';
  if (p.stats.shield && p.shieldUp) {
    p.shieldUp = false;
    p.invulnT = 0.6;
    return 'blocked';
  }
  p.hp -= dmg;
  p.invulnT = 0.5;
  return p.hp <= 0 ? 'dead' : 'hit';
}

export function healOnKill(p) {
  if (p.stats.leech > 0) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.leech);
}
