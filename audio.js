// Muziek, geluidjes en het afspelen van een bewerkte vlog.
// Alles wordt in de browser zelf gemaakt met de Web Audio API: geen extra bestanden nodig.

export const FILTERS = {
  Geen: "none",
  Bos: "sepia(.2) hue-rotate(40deg) saturate(1.2)",
  Warm: "sepia(.35) saturate(1.3)",
  Koel: "hue-rotate(-15deg) saturate(.9) brightness(1.05)",
  Vintage: "sepia(.55) contrast(1.05) brightness(.95)",
  Fel: "saturate(1.7) contrast(1.1)",
  Film: "contrast(1.15) saturate(.8) brightness(.95)",
  "Z/W": "grayscale(1) contrast(1.1)"
};

let AC = null, noiseBuf = null, music = null, fx = null;

export function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function noiseSrc() {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
}
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(out, t, freq, type, a, peak, dec, filt) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); env(g, t, a, peak, dec);
  let n = o;
  if (filt) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filt; o.connect(f); n = f; }
  n.connect(g).connect(out); o.start(t); o.stop(t + a + dec + .05);
  return o;
}
function burst(out, t, type, freq, q, a, peak, dec) {
  const c = ac(), s = noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q; env(g, t, a, peak, dec);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + a + dec + .05);
  return f;
}

export const SFX = {
  ding:   { label: "Ding",    emo: "🔔", fn: (o, t) => { tone(o, t, 1318.5, "sine", .005, .35, 1.2); tone(o, t, 1975.5, "sine", .005, .15, .9); } },
  boing:  { label: "Boing",   emo: "🌀", fn: (o, t) => { const os = tone(o, t, 110, "sine", .01, .5, .55); os.frequency.exponentialRampToValueAtTime(520, t + .18); os.frequency.exponentialRampToValueAtTime(260, t + .5); } },
  whoosh: { label: "Whoosh",  emo: "💨", fn: (o, t) => { const f = burst(o, t, "bandpass", 300, 1.2, .25, .6, .35); f.frequency.exponentialRampToValueAtTime(4000, t + .5); } },
  applaus:{ label: "Applaus", emo: "👏", fn: (o, t) => { for (let i = 0; i < 70; i++) burst(o, t + Math.random() * 1.8, "bandpass", 1200 + Math.random() * 1500, .9, .002, .12 + Math.random() * .2, .07); } },
  roffel: { label: "Roffel",  emo: "🥁", fn: (o, t) => { let x = t, gap = .09; while (x < t + 1.2) { burst(o, x, "bandpass", 1800, .8, .002, .3, .08); x += gap; gap = Math.max(.035, gap * .94); } burst(o, x + .02, "highpass", 5000, .5, .002, .5, 1.3); tone(o, x + .02, 60, "sine", .002, .8, .3); } },
  toeter: { label: "Toeter",  emo: "📯", fn: (o, t) => { [440, 554, 659].forEach(f => tone(o, t, f, "sawtooth", .02, .12, .9, 2400)); } },
  scratch:{ label: "Scratch", emo: "💿", fn: (o, t) => { [0, .22].forEach(d => { const f = burst(o, t + d, "bandpass", 2400, 4, .01, .6, .18); f.frequency.exponentialRampToValueAtTime(300, t + d + .18); }); } },
  tada:   { label: "Tada",    emo: "🎉", fn: (o, t) => { [[72, 0], [76, .08], [79, .16], [84, .24]].forEach(([m, d]) => tone(o, t + d, mf(m), "triangle", .005, .25, d === .24 ? 1 : .25)); } }
};

export const TRACKS = {
  chill: { label: "Chill", sub: "Rustige middag · 84 bpm", bpm: 84, wave: "triangle", cut: 2200, hold: 6, chords: [[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,65]], chordAt: [0,8], bassAt: [0,6,10], kick: [0,7,10], snare: [4,12], hat: [2,6,10,14], hatVol: .06, art: "linear-gradient(160deg,#3f7d5c,#cfe6c2)" },
  lofi:  { label: "Lo-fi", sub: "Studeren, regen op het raam · 72 bpm", bpm: 72, wave: "sine", cut: 1800, hold: 14, chords: [[62,65,69,72],[55,59,64,65],[60,64,67,71],[57,61,64,67]], chordAt: [0], bassAt: [0,10], kick: [0,10], snare: [4,12], hat: [0,2,4,6,8,10,12,14], hatVol: .035, art: "linear-gradient(160deg,#5a63b8,#e3d9a6)" },
  zomer: { label: "Zomer", sub: "Vrolijk, offbeat · 104 bpm", bpm: 104, wave: "square", cut: 1600, hold: 1, chords: [[60,64,67],[55,59,62],[57,60,64],[53,57,60]], chordAt: [2,6,10,14], bassAt: [0,8], kick: [0,8], snare: [4,12], hat: [0,2,4,6,8,10,12,14], hatVol: .05, art: "linear-gradient(160deg,#b0703a,#f2c97a)" },
  hype:  { label: "Hype", sub: "Sport, snelle montage · 128 bpm", bpm: 128, wave: "sawtooth", cut: 2600, hold: 2, chords: [[53,56,60],[49,53,56],[56,60,63],[51,55,58]], chordAt: [0,3,6,10,12], bassAt: [0,2,4,6,8,10,12,14], kick: [0,4,8,12], snare: [4,12], hat: [2,6,10,14], hatVol: .08, art: "linear-gradient(160deg,#b0566b,#7a5ba8)" }
};

function playStep(tr, step, t, out, spb) {
  const bar = Math.floor(step / 16) % tr.chords.length, s = step % 16, ch = tr.chords[bar];
  if (tr.chordAt.includes(s)) ch.forEach(m => tone(out, t, mf(m), tr.wave, .02, tr.wave === "sine" ? .09 : .05, spb * tr.hold, tr.cut));
  if (tr.bassAt.includes(s)) tone(out, t, mf(ch[0] - 24), "triangle", .005, .28, spb * 1.6);
  if (tr.kick.includes(s)) { const k = tone(out, t, 150, "sine", .001, .8, .25); k.frequency.exponentialRampToValueAtTime(45, t + .12); }
  if (tr.snare.includes(s)) burst(out, t, "bandpass", 1800, .7, .001, .3, .12);
  if (tr.hat.includes(s)) burst(out, t, "highpass", 7000, .5, .001, tr.hatVol, .04);
}

// Echte nummers: zet chill.mp3, lofi.mp3, zomer.mp3 en hype.mp3 in een map "music".
// Staat een bestand er niet, dan speelt het ingebouwde deuntje.
export const musicReady = Promise.all(Object.keys(TRACKS).map(async id => {
  try {
    const r = await fetch(`music/${id}.mp3`, { method: "HEAD" });
    if (r.ok && (r.headers.get("content-type") || "").includes("audio")) TRACKS[id].file = `music/${id}.mp3`;
  } catch (e) {}
}));

export function startMusic(id, vol) {
  stopMusic(); if (!id || !TRACKS[id]) return;
  const tr = TRACKS[id];
  if (tr.file) {
    const a = new Audio(tr.file); a.loop = true; a.volume = Math.min(1, vol);
    a.play().catch(() => {});
    music = { audio: a, g: { gain: { set value(v) { a.volume = Math.min(1, v); } } } };
    return;
  }
  const c = ac(), g = c.createGain(); g.gain.value = vol; g.connect(c.destination);
  const spb = 60 / tr.bpm / 4; let step = 0, next = c.currentTime + .06;
  const iv = setInterval(() => { while (next < c.currentTime + .15) { playStep(tr, step, next, g, spb); next += spb; step = (step + 1) % 64; } }, 30);
  music = { iv, g };
}
export function stopMusic() {
  if (!music) return;
  if (music.audio) { music.audio.pause(); music.audio.src = ""; music = null; return; }
  clearInterval(music.iv);
  const g = music.g; g.gain.setTargetAtTime(.0001, ac().currentTime, .05);
  setTimeout(() => g.disconnect(), 400); music = null;
}
export function previewSfx(type) {
  const c = ac(), g = c.createGain(); g.gain.value = .9; g.connect(c.destination);
  SFX[type].fn(g, c.currentTime + .02);
}

// Speelt een video af met de bewerking: knippen, snelheid, volumes, muziek en geluidjes op hun moment
export function playEdit(el, cfg, stageEl, onProg, onDone, onFail) {
  stopEdit(); const c = ac();
  el.currentTime = cfg.start; el.playbackRate = cfg.speed || 1;
  el.volume = cfg.origVol ?? 1; el.muted = (cfg.origVol ?? 1) === 0;
  const out = c.createGain(); out.gain.value = cfg.sfxVol ?? .9; out.connect(c.destination);
  startMusic(cfg.music, cfg.musicVol ?? .5);
  const fired = new Set(); let last = cfg.start - .01;
  fx = { el, raf: 0, out };
  const loop = () => {
    if (!fx || fx.el !== el) return;
    const t = el.currentTime;
    (cfg.sfx || []).forEach((s, i) => {
      if (!fired.has(i) && s.t > last && s.t <= t + .03 && SFX[s.type]) {
        fired.add(i); SFX[s.type].fn(out, c.currentTime);
        if (stageEl) { const b = document.createElement("div"); b.className = "burst"; b.textContent = SFX[s.type].emo + " " + SFX[s.type].label; stageEl.appendChild(b); setTimeout(() => b.remove(), 900); }
      }
    });
    last = t; onProg && onProg(t);
    if (t >= cfg.end || el.ended) { stopEdit(); onDone && onDone(); return; }
    fx.raf = requestAnimationFrame(loop);
  };
  el.play().then(() => { if (fx && fx.el === el) fx.raf = requestAnimationFrame(loop); })
    .catch(() => { stopEdit(); onFail && onFail(); });
}
export function stopEdit() {
  if (!fx) return;
  cancelAnimationFrame(fx.raf);
  try { fx.el.pause(); } catch (e) {}
  fx.out.disconnect(); stopMusic(); fx = null;
}
export const playingOn = el => !!fx && fx.el === el;
export function liveSet({ musicVol, sfxVol, origVol, speed }) {
  if (musicVol != null && music) music.g.gain.value = musicVol;
  if (!fx) return;
  if (sfxVol != null) fx.out.gain.value = sfxVol;
  if (origVol != null) { fx.el.volume = origVol; fx.el.muted = origVol === 0; }
  if (speed != null) fx.el.playbackRate = speed;
}
