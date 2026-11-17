// AETHERFALL config: arena, player, weapons, enemies, upgrades, waves.
export const W = 1280;
export const H = 720;
export const ARENA = { x: 90, y: 70, w: 1100, h: 580 };
export const STEP = 1 / 60;
export const BEST_KEY = 'aetherfall.best.score';
export const BEST_WAVE_KEY = 'aetherfall.best.wave';

export const PLAYER = {
  radius: 14,
  speed: 270,
  maxHp: 100,
  dashSpeed: 720,
  dashTime: 0.16,
  dashCooldown: 2.4,
  dashInvuln: 0.35,
  pickupRadius: 70,
};

// Weapons: id, name, damage, rate (shots/s), projectiles, spread, bulletSpeed, pierce, color
export const WEAPONS = {
  pulse: { id: 'pulse', name: 'Pulse Blaster', damage: 12, rate: 5.0, projectiles: 1, spread: 0, bulletSpeed: 560, pierce: false, color: '#7df9ff', size: 5 },
  scatter: { id: 'scatter', name: 'Scattergun', damage: 7, rate: 2.3, projectiles: 5, spread: 0.55, bulletSpeed: 480, pierce: false, color: '#ffb347', size: 5 },
  rail: { id: 'rail', name: 'Rail Lance', damage: 42, rate: 1.25, projectiles: 1, spread: 0, bulletSpeed: 980, pierce: true, color: '#ff5e78', size: 6 },
};

// Enemy types: hp, speed, radius, damage (touch), shards, color, score
export const ENEMIES = {
  chaser: { hp: 20, speed: 125, radius: 12, damage: 10, shards: 1, color: '#ff4fd8', score: 10 },
  brute: { hp: 85, speed: 62, radius: 20, damage: 20, shards: 3, color: '#ff7a3c', score: 25 },
  spitter: { hp: 30, speed: 82, radius: 12, damage: 12, shards: 2, color: '#7dff6a', score: 20 },
  boss: { hp: 650, speed: 52, radius: 38, damage: 25, shards: 30, color: '#c44dff', score: 500 },
};

export const BOSS_HP_PER_WAVE = 220;

// Upgrade card pool. kind: stat | weapon | special. Each card: id, name, desc, apply(stats).
export const UPGRADE_POOL = [
  { id: 'dmg', name: 'Overcharge', desc: 'Damage +25%', kind: 'stat', stat: 'damageMul', value: 0.25 },
  { id: 'rate', name: 'Rapid Trigger', desc: 'Fire rate +20%', kind: 'stat', stat: 'rateMul', value: 0.20 },
  { id: 'speed', name: 'Ion Thrusters', desc: 'Move speed +15%', kind: 'stat', stat: 'speedMul', value: 0.15 },
  { id: 'hp', name: 'Aegis Plating', desc: 'Max HP +25 and heal 25', kind: 'stat', stat: 'maxHp', value: 25 },
  { id: 'dash', name: 'Phase Coil', desc: 'Dash cooldown -25%', kind: 'stat', stat: 'dashMul', value: -0.25 },
  { id: 'multi', name: 'Split Rounds', desc: '+1 projectile per shot', kind: 'stat', stat: 'extraShots', value: 1 },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pass through enemies', kind: 'special', stat: 'pierce', value: true },
  { id: 'leech', name: 'Vampiric Core', desc: 'Heal 2 HP on every kill', kind: 'special', stat: 'leech', value: 2 },
  { id: 'magnet', name: 'Shard Magnet', desc: 'Pickup radius +60%', kind: 'stat', stat: 'magnetMul', value: 0.60 },
  { id: 'shield', name: 'Ward Field', desc: 'Block one hit per wave', kind: 'special', stat: 'shield', value: true },
  { id: 'scatter', name: 'Scattergun', desc: 'Unlock weapon 2: spread shot', kind: 'weapon', stat: 'scatter', value: true },
  { id: 'rail', name: 'Rail Lance', desc: 'Unlock weapon 3: piercing lance', kind: 'weapon', stat: 'rail', value: true },
];

// Wave composition: how many of each type spawn (before boss waves).
export function waveComp(wave) {
  const chasers = 5 + wave * 2;
  const brutes = wave >= 3 ? Math.floor((wave - 1) / 2) : 0;
  const spitters = wave >= 2 ? Math.floor(wave / 2) : 0;
  return { chaser: chasers, brute: brutes, spitter: spitters };
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}
