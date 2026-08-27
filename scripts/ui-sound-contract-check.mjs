import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const layer = fs.readFileSync('src/components/layout/UiSoundLayer.jsx', 'utf8');
const utility = fs.readFileSync('src/utils/uiSound.js', 'utf8');

const checks = [
  ['App mounts UiSoundLayer', app.includes('<UiSoundLayer />')],
  ['toggle is marked as sound control', layer.includes('data-ui-sound-control')],
  ['delegated feedback is limited to opt-in controls', layer.includes('touch-feedback') && layer.includes('target.dataset.uiSound')],
  ['sound utility supports browser AudioContext', utility.includes('AudioContext')],
  ['sound preference is persisted', utility.includes('localStorage')],
  ['audio failures are non-blocking', utility.includes('.catch(() => {})')],
];

for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
}

if (checks.some(([, passed]) => !passed)) process.exit(1);
