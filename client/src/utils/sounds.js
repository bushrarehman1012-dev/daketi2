let _ctx = null;
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function osc(type, freq, startGain, endGain, dur, startTime = 0) {
  const c   = ctx();
  const t   = c.currentTime + startTime;
  const o   = c.createOscillator();
  const g   = c.createGain();
  o.type    = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(startGain, t);
  g.gain.exponentialRampToValueAtTime(endGain, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.01);
}

function noise(durationSec, gainVal, filterFreq, startTime = 0) {
  const c    = ctx();
  const t    = c.currentTime + startTime;
  const buf  = c.createBuffer(1, c.sampleRate * durationSec, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = 'bandpass'; flt.frequency.value = filterFreq; flt.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(gainVal, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
  src.connect(flt); flt.connect(g); g.connect(c.destination);
  src.start(t); src.stop(t + durationSec);
}

export const sfx = {
  // Card swish — deal / draw at turn start
  deal() {
    try { noise(0.07, 0.35, 2800); } catch (_) {}
  },

  // Drop card onto floor
  drop() {
    try { noise(0.06, 0.22, 1800); } catch (_) {}
  },

  // Pair collected — satisfying double-click
  pair() {
    try {
      osc('sine', 660, 0.35, 0.001, 0.12, 0);
      osc('sine', 880, 0.25, 0.001, 0.1,  0.07);
    } catch (_) {}
  },

  // Steal — sneaky descending whoosh
  steal() {
    try {
      const c = ctx();
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      const flt = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.28);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(2200, t);
      flt.frequency.exponentialRampToValueAtTime(400, t + 0.28);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(flt); flt.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.32);
      // second hit
      noise(0.06, 0.18, 1400, 0.05);
    } catch (_) {}
  },

  // Got stolen from — alarmed sting
  stolenFrom() {
    try {
      osc('square', 440, 0.15, 0.001, 0.12, 0);
      osc('square', 330, 0.12, 0.001, 0.1,  0.12);
    } catch (_) {}
  },

  // 4-of-a-kind lock — ascending arpeggio
  lock() {
    try {
      [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, 0.28, 0.001, 0.18, i * 0.07));
    } catch (_) {}
  },

  // Win fanfare
  win() {
    try {
      [523, 659, 784, 1047, 1319].forEach((f, i) => osc('sine', f, 0.3, 0.001, 0.35, i * 0.1));
    } catch (_) {}
  },

  // Lose — sad descending
  lose() {
    try {
      [392, 349, 311, 261].forEach((f, i) => osc('sine', f, 0.28, 0.001, 0.28, i * 0.12));
    } catch (_) {}
  },
};
