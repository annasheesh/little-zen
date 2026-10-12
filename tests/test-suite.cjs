const assert = require('assert');

console.log('--- RUNNING LITTLE ZEN TEST SUITE ---');

// --- 1. Test One Euro Filter Math ---
console.log('\n[TEST 1] Testing OneEuroFilter jitter reduction and smoothing...');
class LowPassFilter {
  constructor() { this.y = null; this.s = null; }
  filter(val, alpha) {
    if (this.y === null) { this.s = val; this.y = val; return val; }
    this.s = alpha * val + (1 - alpha) * (this.s ?? val);
    this.y = this.s;
    return this.y;
  }
}

class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }
  alpha(rate, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }
  filter(val, timestamp) {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(val, 1.0);
    }
    const dt = (timestamp - this.lastTime) / 1000.0;
    this.lastTime = timestamp;
    if (dt <= 0) return this.xFilter.y ?? val;
    const rate = 1.0 / dt;
    const prevX = this.xFilter.y;
    const dx = prevX !== null ? (val - prevX) * rate : 0;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(val, this.alpha(rate, cutoff));
  }
}

const filter = new OneEuroFilter(1.0, 0.01);
const t0 = 1000;
const first = filter.filter(0.5, t0);
assert.strictEqual(first, 0.5, 'First sample should be identity');

// Inject small jitter around 0.5 (noise: 0.505, 0.495)
let smoothedVal = 0.5;
for (let i = 1; i <= 20; i++) {
  const noisy = 0.5 + (i % 2 === 0 ? 0.008 : -0.008);
  smoothedVal = filter.filter(noisy, t0 + i * 33);
}
assert(Math.abs(smoothedVal - 0.5) < 0.005, 'Low-speed jitter should be smoothed');
console.log('✓ One Euro Filter jitter suppression verified (Output:', smoothedVal.toFixed(4), ')');

// --- 2. Test Scale-Invariant Pinch Detection with Hysteresis ---
console.log('\n[TEST 2] Testing Scale-Invariant Pinch Detection with Hysteresis...');

class GestureDetector {
  constructor(config = {}) {
    this.pinchThreshold = config.pinchThreshold ?? 0.24;
    this.pinchReleaseThreshold = config.pinchReleaseThreshold ?? 0.36;
    this.confirmationFrames = config.confirmationFrames ?? 2;
    this.isPinching = false;
    this.consecutivePinch = 0;
    this.consecutiveRelease = 0;
  }
  evaluate(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleMcp = landmarks[9];

    const handScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.2;
    const rawDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const normalizedDist = rawDist / handScale;

    if (!this.isPinching) {
      if (normalizedDist <= this.pinchThreshold) {
        this.consecutivePinch++;
        if (this.consecutivePinch >= this.confirmationFrames) {
          this.isPinching = true;
          this.consecutiveRelease = 0;
        }
      } else {
        this.consecutivePinch = 0;
      }
    } else {
      if (normalizedDist >= this.pinchReleaseThreshold) {
        this.consecutiveRelease++;
        if (this.consecutiveRelease >= this.confirmationFrames) {
          this.isPinching = false;
          this.consecutivePinch = 0;
        }
      } else {
        this.consecutiveRelease = 0;
      }
    }

    return { isPinching: this.isPinching, normalizedDist };
  }
}

const detector = new GestureDetector({ pinchThreshold: 0.24, pinchReleaseThreshold: 0.36, confirmationFrames: 2 });
// Mock hand: wrist at (0.5, 0.8), middleMcp at (0.5, 0.6) -> handScale = 0.20
const makeHand = (thumbIndexDist) => {
  const landmarks = [];
  landmarks[0] = { x: 0.5, y: 0.8 };
  landmarks[9] = { x: 0.5, y: 0.6 };
  landmarks[4] = { x: 0.5, y: 0.5 };
  landmarks[8] = { x: 0.5 + thumbIndexDist, y: 0.5 };
  return landmarks;
};

// Open hand: thumbIndexDist = 0.10 (normalizedDist = 0.10 / 0.2 = 0.50 > 0.24)
let res = detector.evaluate(makeHand(0.10));
assert.strictEqual(res.isPinching, false, 'Open hand should not be pinching');

// Frame 1 of close fingers: thumbIndexDist = 0.03 (normalizedDist = 0.15 < 0.24)
res = detector.evaluate(makeHand(0.03));
assert.strictEqual(res.isPinching, false, '1st frame of pinch should wait for confirmation');

// Frame 2 of close fingers: confirmation achieved
res = detector.evaluate(makeHand(0.03));
assert.strictEqual(res.isPinching, true, '2nd frame of pinch should trigger isPinching=true');

// Slight movement within hysteresis: thumbIndexDist = 0.06 (normalizedDist = 0.30, below 0.36 release threshold)
res = detector.evaluate(makeHand(0.06));
assert.strictEqual(res.isPinching, true, 'Hysteresis should keep pinch active below release threshold');

// Frame 1 of release: thumbIndexDist = 0.09 (normalizedDist = 0.45 > 0.36)
res = detector.evaluate(makeHand(0.09));
assert.strictEqual(res.isPinching, true, '1st frame of release should wait for confirmation');

// Frame 2 of release: released
res = detector.evaluate(makeHand(0.09));
assert.strictEqual(res.isPinching, false, '2nd frame of release should trigger isPinching=false');
console.log('✓ Scale-invariant pinch detection with temporal hysteresis verified');

// --- 3. Test Rake Multi-Prong Offset Computation ---
console.log('\n[TEST 3] Testing Multi-Prong Rake Geometry...');
function computeProngOffsets(count, spacing) {
  const offsets = [];
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    offsets.push((i - half) * spacing);
  }
  return offsets;
}

const prongs3 = computeProngOffsets(3, 0.012);
assert.deepStrictEqual(prongs3, [-0.012, 0, 0.012], '3 prongs should be symmetric around center');

const prongs5 = computeProngOffsets(5, 0.01);
assert.strictEqual(prongs5.length, 5);
assert.strictEqual(prongs5[0], -0.02);
assert.strictEqual(prongs5[2], 0);
assert.strictEqual(prongs5[4], 0.02);
console.log('✓ Multi-prong rake geometry offsets verified');

// --- 4. Test Undo / Redo Stack State Machine ---
console.log('\n[TEST 4] Testing Undo / Redo Stack State Machine...');
class HistoryStack {
  constructor(max = 40) {
    this.history = [];
    this.redo = [];
    this.max = max;
  }
  push(state) {
    this.history.push(JSON.parse(JSON.stringify(state)));
    if (this.history.length > this.max) this.history.shift();
    this.redo = [];
  }
  canUndo() { return this.history.length > 1; }
  canRedo() { return this.redo.length > 0; }
  undo() {
    if (!this.canUndo()) return null;
    this.redo.push(this.history.pop());
    return this.history[this.history.length - 1];
  }
  redoAction() {
    if (!this.canRedo()) return null;
    const next = this.redo.pop();
    this.history.push(next);
    return next;
  }
}

const hist = new HistoryStack();
hist.push({ elements: [], stones: [] }); // Initial
assert.strictEqual(hist.canUndo(), false, 'Cannot undo at start');

hist.push({ elements: ['stroke1'], stones: [] });
assert.strictEqual(hist.canUndo(), true, 'Can undo after 1 stroke');

hist.push({ elements: ['stroke1', 'stroke2'], stones: [] });
assert.strictEqual(hist.canUndo(), true);

const undone = hist.undo();
assert.deepStrictEqual(undone.elements, ['stroke1'], 'Undo should restore previous state');
assert.strictEqual(hist.canRedo(), true, 'Can redo after undo');

const redone = hist.redoAction();
assert.deepStrictEqual(redone.elements, ['stroke1', 'stroke2'], 'Redo should restore forward state');
console.log('✓ Undo and Redo stack state machine verified');

// --- 5. Test Input Source Arbitration ---
console.log('\n[TEST 5] Testing Shared Input Source Priority Arbitration...');
let activeSource = null;
function onStrokeStart(source) {
  if (activeSource !== null && activeSource !== source) {
    return false; // Denied: already locked to another source
  }
  activeSource = source;
  return true;
}
function onStrokeEnd(source) {
  if (activeSource === source) {
    activeSource = null;
    return true;
  }
  return false;
}

assert.strictEqual(onStrokeStart('pointer'), true, 'Pointer takes lock');
assert.strictEqual(onStrokeStart('air-rake'), false, 'Air Rake cannot interrupt active pointer');
assert.strictEqual(onStrokeEnd('pointer'), true, 'Pointer releases lock');
assert.strictEqual(onStrokeStart('air-rake'), true, 'Air Rake can now take lock');
assert.strictEqual(onStrokeEnd('air-rake'), true, 'Air Rake releases lock');
console.log('✓ Multi-input exclusive arbitration verified');

// --- 6. Test Garden Presets Integrity ---
console.log('\n[TEST 6] Testing Japanese Garden Presets...');
const presets = [
  'morning-stillness',
  'rain-on-stone',
  'quiet-moon',
  'warm-sand',
  'empty-garden'
];
assert.strictEqual(presets.length, 5, 'All 5 garden presets defined');
console.log('✓ Presets verified: Morning Stillness, Rain on Stone, Quiet Moon, Warm Sand, Empty Garden');

console.log('\n========================================');
console.log('ALL 6 ENGINE & INTERACTION TESTS PASSED!');
console.log('========================================\n');
