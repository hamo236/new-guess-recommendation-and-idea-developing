const STORAGE_KEY = 'neon-guess-ui-sound-enabled';
let audioContext = null;

export function isUiSoundEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setUiSoundEnabled(enabled) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Boolean(enabled)));
    } catch {
      // Sound remains available for this session when storage is unavailable.
    }
  }
  return Boolean(enabled);
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

export function playUiClickSound(kind = 'click') {
  if (!isUiSoundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;

  const start = () => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isConfirm = kind === 'confirm';
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(isConfirm ? 620 : 480, now);
    oscillator.frequency.exponentialRampToValueAtTime(isConfirm ? 760 : 560, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  };

  if (context.state === 'suspended') {
    context.resume().then(start).catch(() => {});
  } else {
    start();
  }
}
