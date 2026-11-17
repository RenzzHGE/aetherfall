// WebAudio synth SFX: no audio files, everything is generated. M toggles mute.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ type = 'square', freq = 440, freqEnd = null, dur = 0.08, vol = 0.12, delay = 0 }) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.18, freq = 1200, delay = 0 }) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(ac.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    shoot() { tone({ type: 'square', freq: 720, freqEnd: 240, dur: 0.06, vol: 0.07 }); },
    shootRail() { tone({ type: 'sawtooth', freq: 180, freqEnd: 1400, dur: 0.12, vol: 0.1 }); },
    hit() { noise({ dur: 0.06, vol: 0.08, freq: 2400 }); },
    explode() { noise({ dur: 0.28, vol: 0.2, freq: 900 }); tone({ type: 'sine', freq: 160, freqEnd: 40, dur: 0.25, vol: 0.18 }); },
    pickup() { tone({ type: 'sine', freq: 880, dur: 0.05, vol: 0.07 }); tone({ type: 'sine', freq: 1320, dur: 0.07, vol: 0.06, delay: 0.05 }); },
    upgrade() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.1, delay: i * 0.07 })); },
    hurt() { tone({ type: 'sawtooth', freq: 220, freqEnd: 70, dur: 0.2, vol: 0.16 }); },
    dash() { noise({ dur: 0.12, vol: 0.08, freq: 3200 }); },
    bossRoar() { tone({ type: 'sawtooth', freq: 90, freqEnd: 220, dur: 0.5, vol: 0.16 }); noise({ dur: 0.4, vol: 0.12, freq: 500 }); },
    bossDie() { noise({ dur: 0.7, vol: 0.25, freq: 700 }); tone({ type: 'sine', freq: 120, freqEnd: 28, dur: 0.7, vol: 0.22 }); },
    waveClear() { [392, 523, 659].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.14, vol: 0.1, delay: i * 0.08 })); },
    gameOver() { [440, 349, 293, 220].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.25, vol: 0.12, delay: i * 0.18 })); },
    click() { tone({ type: 'sine', freq: 660, dur: 0.05, vol: 0.08 }); },
  };
}
