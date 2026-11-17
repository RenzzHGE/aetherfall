// Keyboard + mouse input. Edge-triggered actions are consumed once per frame via takeActions().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

export function createInput(canvas) {
  const keys = new Set();
  const edge = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function onKey(e, down) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (down && !keys.has(k)) edge.add(k);
    if (down) keys.add(k);
    else keys.delete(k);
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  function has(...names) {
    return names.some((n) => keys.has(n));
  }

  return {
    // Movement vector, normalized.
    direction() {
      let x = 0;
      let y = 0;
      if (has('a', 'ArrowLeft')) x -= 1;
      if (has('d', 'ArrowRight')) x += 1;
      if (has('w', 'ArrowUp')) y -= 1;
      if (has('s', 'ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    aim() { return { x: mouseX, y: mouseY }; },
    firing() { return mouseDown; },
    clicked() { const c = mouseClicked; mouseClicked = false; return c; },
    // Edge actions, consumed once per call. Digit keys are left for digit() to read.
    takeActions() {
      let a = 0;
      const pressed = (n) => edge.has(n);
      if (pressed(' ') || pressed('Enter')) a |= ACTION_CONFIRM;
      if (pressed('p') || pressed('P') || pressed('Escape')) a |= ACTION_PAUSE;
      if (pressed('Shift')) a |= ACTION_DASH;
      if (pressed('m') || pressed('M')) a |= ACTION_MUTE;
      if (pressed('r') || pressed('R')) a |= ACTION_RESTART;
      for (const k of [...edge]) {
        if (!['1', '2', '3'].includes(k)) edge.delete(k);
      }
      return a;
    },
    // Digit keys 1-3 pressed this frame (upgrade card pick / weapon switch).
    digit() {
      for (const d of ['1', '2', '3']) {
        if (edge.has(d)) { edge.delete(d); return Number(d); }
      }
      return 0;
    },
  };
}
