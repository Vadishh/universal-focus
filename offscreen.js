/* Universal Focus — Offscreen Audio Engine (High-Fidelity & Punchy) */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playFocusTone(volume = 0.85) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const vol = Math.max(0.1, Math.min(1.2, Number(volume) || 0.85));

    // Master Dynamics Compressor: boosts perceived volume & clarity, prevents clipping
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, now);
    compressor.knee.setValueAtTime(6, now);
    compressor.ratio.setValueAtTime(4, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.06, now);
    compressor.connect(ctx.destination);

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.connect(compressor);

    // ── Layer 1: Bright Lead Chime (triangle wave, cuts through speakers) ──
    const leadOsc = ctx.createOscillator();
    const leadGain = ctx.createGain();
    leadOsc.type = "triangle";
    leadOsc.frequency.setValueAtTime(784, now); // G5
    leadOsc.frequency.exponentialRampToValueAtTime(1174, now + 0.05); // D6

    leadGain.gain.setValueAtTime(0.001, now);
    leadGain.gain.linearRampToValueAtTime(0.85, now + 0.004);
    leadGain.gain.setValueAtTime(0.85, now + 0.025); // 20ms hold for punch
    leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    leadOsc.connect(leadGain);
    leadGain.connect(masterGain);

    // ── Layer 2: Harmonic Air & Body (sine wave overtone at 1568Hz) ──
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = "sine";
    overtoneOsc.frequency.setValueAtTime(1568, now); // G6 octave
    overtoneOsc.frequency.exponentialRampToValueAtTime(2093, now + 0.05); // C7

    overtoneGain.gain.setValueAtTime(0.001, now);
    overtoneGain.gain.linearRampToValueAtTime(0.45, now + 0.005);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(masterGain);

    // ── Layer 3: Tactile Mechanical Pop / Transient (sine drop) ──
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(650, now);
    popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.035);

    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.70, now + 0.003);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    popOsc.connect(popGain);
    popGain.connect(masterGain);

    // Start all layers
    leadOsc.start(now);
    overtoneOsc.start(now);
    popOsc.start(now);

    // Stop all layers cleanly
    leadOsc.stop(now + 0.19);
    overtoneOsc.stop(now + 0.16);
    popOsc.stop(now + 0.06);
  } catch (err) {
    console.error("[Universal Focus Audio]", err);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PLAY_AUDIO") {
    playFocusTone(message.volume);
  }
});
