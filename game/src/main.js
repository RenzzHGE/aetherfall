// Boot and the one loop: input every frame, the world advances in fixed 1/60 s steps,
// and the renderer paints what is there. Screens: title, play, upgrade, paused, game over.
//
// ?seed=N fixes the run. ?shot=title|combat|upgrade|boss (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, BEST_WAVE_KEY, STEP } from './config.js';
import { createRandom } from './utils.js';
import { createWorld, resetWorld, stepWorld, stepTitle, startWave, nextWave, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_BOSS_DIE, EVENT_HURT } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH, ACTION_MUTE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { applyUpgrade, switchWeapon } from './player.js';
import { cardRects, drawCards } from './upgrades.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return {
      score: Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0,
      wave: Number.parseInt(window.localStorage.getItem(BEST_WAVE_KEY) ?? '0', 10) || 0,
    };
  } catch {
    return { score: 0, wave: 0 };
  }
}

function saveBest(score, wave) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
    window.localStorage.setItem(BEST_WAVE_KEY, String(wave));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    draw(renderer, world, scene.screen, scene.best, 7);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetWorld(world);
    startWave(world, 1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Wave 1. Survive.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.score > best.score) best.score = world.score;
    if (world.wave > best.wave) best.wave = world.wave;
    saveBest(best.score, best.wave);
    audio.gameOver();
    announce(`Game over. Score ${world.score}, wave ${world.wave}. Best ${best.score}.`);
  }

  function pickCard(i) {
    const card = world.cards[i];
    if (!card) return;
    applyUpgrade(world.player, card);
    audio.upgrade();
    announce(`Picked ${card.name}. Wave ${world.wave + 1}.`);
    nextWave(world);
    screen = SCREEN_PLAY;
  }

  function handleClickCard() {
    if (screen !== SCREEN_UPGRADE) return false;
    const aim = input.aim();
    const rects = cardRects();
    for (let i = 0; i < rects.length; i += 1) {
      const rc = rects[i];
      if (aim.x >= rc.x && aim.x <= rc.x + rc.w && aim.y >= rc.y && aim.y <= rc.y + rc.h) {
        pickCard(i);
        return true;
      }
    }
    return false;
  }

  function step(wantDash) {
    if (screen === SCREEN_TITLE) {
      stepTitle(world, STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const aim = input.aim();
    const events = stepWorld(world, dir, aim, input.firing(), wantDash, STEP);
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_BOSS_DIE) audio.bossDie();
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.wave} cleared. Pick an upgrade.`);
    }
    if (events & EVENT_OVER) endGame();
    if (world.boss && !world.bossRoared) {
      world.bossRoared = true;
      audio.bossRoar();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_PAUSED)) startGame();

    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      input.digit(); // consume (discard) digits pressed on a screen that ignores them
      if ((actions & ACTION_CONFIRM) || input.clicked()) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      const d = input.digit();
      if (d >= 1 && d <= 3) switchWeapon(world.player, d);
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      const d = input.digit();
      if (d >= 1 && d <= 3) pickCard(d - 1);
      else if (input.clicked()) handleClickCard();
      else if (actions & ACTION_RESTART) {
        // Reroll the three cards for 10 shards.
        if (world.shardCount >= 10) {
          world.shardCount -= 10;
          world.cards = drawCards(world.rng, world.player.stats.weapons);
          audio.click();
        }
      }
    }

    if (screen === SCREEN_PLAY) {
      // Dash is an edge action read once per frame, applied to the first step.
      const wantDash = Boolean(actions & ACTION_DASH);
      let first = true;
      while (accumulator >= STEP) {
        step(first ? wantDash : false);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        step(false);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    draw(renderer, world, screen, best.score, best.wave);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('AETHERFALL. Press Space or click to start.');
  // Debug/test hook: lets an automated play-test aim at real enemies and read state.
  // Harmless in normal play; the game never reads it.
  window.__aetherfall = { world, get screen() { return screen; } };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
