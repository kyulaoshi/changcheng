// =====================================================================
//  효과음 (Web Audio API로 직접 합성 → 음원 파일 불필요)
//  브라우저 자동재생 제한 때문에 첫 클릭/키 입력 뒤에 활성화됩니다.
// =====================================================================

const KEY = 'ccjs-sound';
let ctx = null;
let master = null;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 첫 사용자 동작에서 오디오를 깨웁니다 */
export function unlockAudioOnFirstGesture() {
  const go = () => {
    ensure();
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

export function isSoundOn() { return enabled; }
export function setSound(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {}
  if (enabled) ensure();
}

function tone(freq, start, dur, { type = 'square', vol = 0.5, slideTo = null, attack = 0.005 } = {}) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start, dur, vol = 0.3, hp = 800) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + start;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, A4: 440, C4: 261.63 };

export const sfx = {
  count()   { tone(NOTE.A4, 0, 0.18, { type: 'square', vol: 0.35 }); },
  go()      { tone(NOTE.A5, 0, 0.12, { vol: 0.4 }); tone(NOTE.C6, 0.1, 0.35, { vol: 0.4 }); noise(0, 0.25, 0.15, 2000); },
  correct() { tone(NOTE.E5, 0, 0.08, { type: 'triangle', vol: 0.55 }); tone(NOTE.C6, 0.07, 0.16, { type: 'triangle', vol: 0.55 }); },
  wrong()   { tone(180, 0, 0.22, { type: 'sawtooth', vol: 0.3, slideTo: 110 }); },
  boost()   { tone(300, 0, 0.35, { type: 'sawtooth', vol: 0.25, slideTo: 1400 }); noise(0, 0.35, 0.2, 1200); },
  boostBig(){ tone(220, 0, 0.5, { type: 'sawtooth', vol: 0.28, slideTo: 1800 }); tone(440, 0.05, 0.45, { type: 'square', vol: 0.15, slideTo: 2200 }); noise(0, 0.5, 0.3, 900); },
  finish()  { [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'square', vol: 0.35 })); },
  victory() {
    const seq = [[NOTE.G4, 0], [NOTE.C5, 0.15], [NOTE.E5, 0.3], [NOTE.G5, 0.45], [NOTE.E5, 0.65], [NOTE.G5, 0.8], [NOTE.C6, 1.0]];
    seq.forEach(([f, t]) => tone(f, t, 0.3, { type: 'square', vol: 0.3 }));
    tone(NOTE.C4, 1.0, 0.8, { type: 'triangle', vol: 0.4 });
    [1.2, 1.5, 1.8].forEach(t => noise(t, 0.4, 0.25, 500));
  },
  click()   { tone(900, 0, 0.04, { type: 'square', vol: 0.15 }); },
  join()    { tone(NOTE.C5, 0, 0.08, { type: 'triangle', vol: 0.3 }); tone(NOTE.G5, 0.08, 0.12, { type: 'triangle', vol: 0.3 }); },
};
