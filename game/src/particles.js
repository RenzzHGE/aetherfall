// Juice: particles, floating damage numbers, screen shake, slow-mo.
export function createFx() {
  return {
    particles: [],
    texts: [],
    shake: 0,
    slowmo: 0,
  };
}

export function burst(fx, x, y, color, n, speed = 260) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.35, maxLife: 0.75,
      size: 2 + Math.random() * 4, color,
    });
  }
  if (fx.particles.length > 420) fx.particles.splice(0, fx.particles.length - 420);
}

export function floatText(fx, x, y, text, color = '#ffffff', size = 15) {
  fx.texts.push({ x, y, text, color, size, life: 0.8 });
  if (fx.texts.length > 40) fx.texts.shift();
}

export function addShake(fx, amount) {
  fx.shake = Math.min(18, fx.shake + amount);
}

export function slowMo(fx, seconds) {
  fx.slowmo = Math.max(fx.slowmo, seconds);
}

export function stepFx(fx, dt) {
  for (const p of fx.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.y -= 42 * dt;
    t.life -= dt;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 26);
  fx.slowmo = Math.max(0, fx.slowmo - dt);
}

export function shakeOffset(fx) {
  if (fx.shake <= 0.2) return { x: 0, y: 0 };
  return {
    x: (Math.random() * 2 - 1) * fx.shake,
    y: (Math.random() * 2 - 1) * fx.shake,
  };
}
