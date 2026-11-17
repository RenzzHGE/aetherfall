// Renderer: arena, entities, particles, HUD, and all screens.
import { W, H, ARENA, WEAPONS } from './config.js';
import { fmt } from './utils.js';
import { shakeOffset } from './particles.js';
import { cardRects } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  // Parallax starfield (fixed, generated once).
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, r: 0.6 + Math.random() * 1.6 });
  }
  return { ctx, stars };
}

function drawBackground(r, t) {
  const { ctx, stars } = r;
  const g = ctx.createRadialGradient(640, 360, 80, 640, 360, 900);
  g.addColorStop(0, '#1a1033');
  g.addColorStop(0.6, '#0d0a1e');
  g.addColorStop(1, '#05040c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + s.x);
    ctx.globalAlpha = 0.25 + 0.55 * tw * s.z;
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawArena(r) {
  const { ctx } = r;
  ctx.save();
  ctx.strokeStyle = 'rgba(125,249,255,0.55)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 18;
  ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  ctx.restore();
  // Corner accents.
  ctx.strokeStyle = 'rgba(255,209,102,0.8)';
  ctx.lineWidth = 3;
  const c = 18;
  for (const [x, y, sx, sy] of [
    [ARENA.x, ARENA.y, 1, 1], [ARENA.x + ARENA.w, ARENA.y, -1, 1],
    [ARENA.x, ARENA.y + ARENA.h, 1, -1], [ARENA.x + ARENA.w, ARENA.y + ARENA.h, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * c, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * c);
    ctx.stroke();
  }
}

function circle(ctx, x, y, rad, fill, glow = null) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(r, p) {
  const { ctx } = r;
  // Dash trail.
  for (const t of p.trail) {
    ctx.globalAlpha = (t.t / 0.22) * 0.35;
    circle(ctx, t.x, t.y, p.radius * 0.8, '#7df9ff');
  }
  ctx.globalAlpha = 1;
  // Shield ring.
  if (p.shieldUp) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125,249,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Blink while invulnerable.
  if (p.invulnT > 0 && Math.floor(p.invulnT * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  // Body + gun.
  circle(ctx, p.x, p.y, p.radius, '#e8f6ff', '#7df9ff');
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = '#2b3a55';
  ctx.fillRect(6, -4, 20, 8);
  if (p.muzzle > 0) {
    ctx.fillStyle = '#fff6a3';
    ctx.beginPath();
    ctx.arc(28, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // HP arc above the player.
  const frac = Math.max(0, p.hp / p.stats.maxHp);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(p.x - 18, p.y - p.radius - 12, 36, 4);
  ctx.fillStyle = frac > 0.5 ? '#7dff6a' : frac > 0.25 ? '#ffd166' : '#ff5e78';
  ctx.fillRect(p.x - 18, p.y - p.radius - 12, 36 * frac, 4);
}

function drawEnemies(r, enemies) {
  const { ctx } = r;
  for (const e of enemies) {
    const def = e.type;
    // Boss: big spiky body + crown.
    if (def === 'boss') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.sin(e.id + performance.now() / 400) * 0.1);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#c44dff';
      ctx.shadowColor = '#c44dff';
      ctx.shadowBlur = 26;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 === 0 ? e.radius + 10 : e.radius - 4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Boss eyes.
      circle(ctx, e.x - 12, e.y - 6, 5, '#ff5e78');
      circle(ctx, e.x + 12, e.y - 6, 5, '#ff5e78');
      // Boss HP bar.
      const bw = 180;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 22, bw, 7);
      ctx.fillStyle = '#c44dff';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 22, bw * Math.max(0, e.hp / e.maxHp), 7);
      continue;
    }
    const color = def === 'chaser' ? '#ff4fd8' : def === 'brute' ? '#ff7a3c' : '#7dff6a';
    circle(ctx, e.x, e.y, e.radius, e.flash > 0 ? '#ffffff' : color, color);
    // Face details.
    if (def === 'brute') {
      ctx.fillStyle = '#3a0d00';
      ctx.fillRect(e.x - 8, e.y - 4, 5, 5);
      ctx.fillRect(e.x + 3, e.y - 4, 5, 5);
    } else if (def === 'spitter') {
      ctx.fillStyle = '#0d2b00';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2b0033';
      ctx.beginPath();
      ctx.arc(e.x - 4, e.y - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(e.x + 4, e.y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // HP bar for tough enemies.
    if (e.maxHp > 40) {
      const bw = e.radius * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw, 4);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
}

function drawHud(r, w, best) {
  const { ctx } = r;
  const p = w.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top bar.
  ctx.fillStyle = 'rgba(5,4,12,0.55)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`WAVE ${w.wave}`, 20, 30);
  ctx.fillText(`SCORE ${fmt(w.score)}`, 170, 30);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`◆ ${w.shardCount}`, 380, 30);
  if (w.combo > 1) {
    ctx.fillStyle = '#ff9f1c';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`COMBO x${w.combo}`, 500, 30);
  }
  ctx.fillStyle = '#9fb3d9';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`BEST ${fmt(best)}`, 760, 30);
  ctx.fillText(`KILLS ${w.kills}`, 900, 30);
  // HP bar.
  const bx = 1030;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(bx, 14, 170, 18);
  const frac = Math.max(0, p.hp / p.stats.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#7dff6a' : frac > 0.25 ? '#ffd166' : '#ff5e78';
  ctx.fillRect(bx, 14, 170 * frac, 18);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)}/${p.stats.maxHp}`, bx + 60, 28);
  // Weapon + dash.
  ctx.fillStyle = '#7df9ff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(WEAPONS[p.stats.weapon].name, 1260, 56);
  ctx.fillStyle = p.dashCd <= 0 ? '#7dff6a' : '#9fb3d9';
  ctx.fillText(p.dashCd <= 0 ? 'DASH READY [Space]' : `DASH ${p.dashCd.toFixed(1)}s`, 1260, 76);
  ctx.textAlign = 'left';
  // Boss bar.
  if (w.boss) {
    const bw = 420;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VOIDLORD', 640, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(640 - bw / 2, 58, bw, 12);
    ctx.fillStyle = '#c44dff';
    ctx.fillRect(640 - bw / 2, 58, bw * Math.max(0, w.boss.hp / w.boss.maxHp), 12);
    ctx.textAlign = 'left';
  }
  // Wave banner.
  if (w.bannerT > 0 && w.waveState === 'fighting') {
    ctx.globalAlpha = Math.min(1, w.bannerT);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(w.wave % 5 === 0 ? `WAVE ${w.wave} — VOIDLORD` : `WAVE ${w.wave}`, 640, 200);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function drawUpgrade(r, w) {
  const { ctx } = r;
  ctx.fillStyle = 'rgba(5,4,12,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${w.wave} CLEARED`, 640, 150);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`Score ${fmt(w.score)}   •   Shards ${w.shardCount}   •   Click a card or press 1 / 2 / 3`, 640, 190);
  ctx.fillText('Reroll costs 10 shards — press R', 640, 218);
  const rects = cardRects();
  w.cards.forEach((card, i) => {
    const rc = rects[i];
    ctx.save();
    ctx.fillStyle = '#141b33';
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(rc.x, rc.y, rc.w, rc.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#7df9ff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(card.name, rc.x + rc.w / 2, rc.y + 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px system-ui, sans-serif';
    const words = card.desc.split(' ');
    let line = '';
    let ly = rc.y + 92;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 26) {
        ctx.fillText(line.trim(), rc.x + rc.w / 2, ly);
        ly += 24;
        line = word;
      } else line += ' ' + word;
    }
    ctx.fillText(line.trim(), rc.x + rc.w / 2, ly);
    ctx.fillStyle = '#9fb3d9';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, rc.x + rc.w / 2, rc.y + rc.h - 24);
  });
  ctx.textAlign = 'left';
}

function drawCenterText(r, title, lines, accent = '#7df9ff') {
  const { ctx } = r;
  ctx.fillStyle = 'rgba(5,4,12,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.fillText(title, 640, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  let y = 310;
  for (const line of lines) {
    ctx.fillText(line, 640, y);
    y += 32;
  }
  ctx.textAlign = 'left';
}

export function draw(r, w, screen, best, bestWave) {
  const { ctx } = r;
  const off = shakeOffset(w.fx);
  ctx.save();
  ctx.translate(off.x, off.y);
  drawBackground(r, w.time);
  drawArena(r);

  // Shards.
  for (const s of w.shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.t * 3);
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 8;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Orbs.
  for (const o of w.orbs) circle(ctx, o.x, o.y, o.r, o.color, o.color);
  // Bullets.
  for (const b of w.bullets) circle(ctx, b.x, b.y, b.r, b.color, b.color);
  drawEnemies(r, w.enemies);
  // Particles.
  for (const p of w.fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    circle(ctx, p.x, p.y, p.size, p.color);
  }
  ctx.globalAlpha = 1;
  // Floating texts.
  ctx.textAlign = 'center';
  for (const t of w.fx.texts) {
    ctx.globalAlpha = Math.max(0, t.life / 0.8);
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawPlayer(r, w.player);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) drawHud(r, w, best);
  ctx.restore();

  if (screen === SCREEN_TITLE) {
    drawCenterText(r, 'AETHERFALL', [
      'A lone warden. An endless arena. Survive the fall.',
      '',
      'WASD move  •  Mouse aim  •  Click / hold to shoot  •  Space dash',
      '1 / 2 / 3 switch weapons  •  P pause  •  M mute',
      '',
      `Best score ${fmt(best)}  •  Best wave ${bestWave}`,
      '',
      'Press Space or click to begin',
    ]);
  } else if (screen === SCREEN_UPGRADE) {
    drawUpgrade(r, w);
  } else if (screen === SCREEN_PAUSED) {
    drawCenterText(r, 'PAUSED', ['Press P or Space to resume', 'M mute  •  R restart'], '#ffd166');
  } else if (screen === SCREEN_OVER) {
    drawCenterText(r, 'THE FALL CLAIMS YOU', [
      `Score ${fmt(w.score)}  •  Wave ${w.wave}  •  Kills ${w.kills}  •  Best combo x${w.comboBest}`,
      `Best score ${fmt(best)}  •  Best wave ${bestWave}`,
      '',
      'Press Space or click to try again',
    ], '#ff5e78');
  }
}
