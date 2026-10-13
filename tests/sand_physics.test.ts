import { SandHeightfield } from '../src/engine/simulation/SandHeightfield';
import { RakeEngine } from '../src/engine/RakeEngine';
import { parseColor } from '../src/engine/render/SandFieldRenderer';
import { SAND_PALETTES } from '../src/engine/render/palettes';
import { GARDEN_PRESETS } from '../src/engine/persistence/presets';
import { GardenStone } from '../src/types/garden';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log('--- Starting Comprehensive Zen Garden Sand Physics Test Suite ---');

// 1. Initial State & Dimensions Test
{
  console.log('1. Testing SandHeightfield initialization...');
  const hf = new SandHeightfield(800, 600);
  assert(hf.width === 800, 'Width must match 800');
  assert(hf.height === 600, 'Height must match 600');
  assert(hf.heights.length === 800 * 600, 'Buffer length must match 800*600');

  let anyNonZero = false;
  for (let i = 0; i < hf.heights.length; i++) {
    if (hf.heights[i] !== 0) {
      anyNonZero = true;
      break;
    }
  }
  assert(!anyNonZero, 'Initial heightfield must be flat (all 0.0)');
  console.log('   ✓ Initialization verified.');
}

// 2. Mass Conservation & Displacement (Trough & Berms) Test
{
  console.log('2. Testing Volume Displacement & Berm Generation...');
  const hf = new SandHeightfield(800, 600);
  hf.carveRakeSegment(
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 },
    [0],
    0.015,
    1.0
  );

  let minH = 0;
  let maxH = 0;
  let negativeCount = 0;
  let positiveCount = 0;

  for (let i = 0; i < hf.heights.length; i++) {
    const h = hf.heights[i];
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
    if (h < -0.01) negativeCount++;
    if (h > 0.01) positiveCount++;
  }

  console.log(`   Min elevation (trough): ${minH.toFixed(4)}`);
  console.log(`   Max elevation (berm): ${maxH.toFixed(4)}`);
  console.log(`   Trough cells: ${negativeCount}, Berm cells: ${positiveCount}`);

  assert(minH <= -0.35, 'Trough must reach negative depth ~ -0.4');
  assert(maxH >= 0.15, 'Berm must rise to positive ridge height ~ +0.18');
  assert(negativeCount > 100, 'Should have carved trough cells');
  assert(positiveCount > 100, 'Should have displaced berm cells');
  console.log('   ✓ Displacement & berm physics verified.');
}

// 3. Multi-Prong Rake Crest Merging Test
{
  console.log('3. Testing Multi-Prong Crest Merging between Tines...');
  const hf = new SandHeightfield(800, 600);
  const prongSpacing = 0.015;
  const prongs = [-prongSpacing, 0, prongSpacing];

  hf.carveRakeSegment(
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 },
    prongs,
    0.008,
    1.0
  );

  // Sample vertical cross-section at x = 0.5 across the 3 tines
  const gx = 400;
  const cy = 300; // y = 0.5
  const sampleRange = 30; // +/- 30 cells
  const profile: { gy: number; y: number; h: number }[] = [];

  for (let dy = -sampleRange; dy <= sampleRange; dy++) {
    const gy = cy + dy;
    const h = hf.heights[gy * hf.width + gx];
    profile.push({ gy, y: gy / 599, h });
  }

  // Count local minima (troughs) and local maxima (crests between tines)
  let localMinima = 0;
  let localMaxima = 0;
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i].h < profile[i - 1].h && profile[i].h < profile[i + 1].h && profile[i].h < -0.1) {
      localMinima++;
    }
    if (profile[i].h > profile[i - 1].h && profile[i].h > profile[i + 1].h && profile[i].h > 0.05) {
      localMaxima++;
    }
  }

  // Count local troughs (h < -0.2) and raised crests (h > 0.2)
  let troughCount = 0;
  let crestCount = 0;
  for (let i = 1; i < profile.length - 1; i++) {
    // Trough center check (allowing for flat bottom)
    if (profile[i].h < -0.2 && profile[i].h <= profile[i - 1].h && profile[i].h <= profile[i + 1].h && (profile[i - 1].h > profile[i].h || profile[i + 1].h > profile[i].h)) {
      troughCount++;
    }
    // Ridge crest check
    if (profile[i].h > 0.2 && profile[i].h >= profile[i - 1].h && profile[i].h >= profile[i + 1].h) {
      crestCount++;
    }
  }

  console.log(`   Profile troughs: ${troughCount}, crests: ${crestCount}`);
  assert(troughCount >= 3, 'Must have 3 distinct tine troughs');
  assert(crestCount >= 2, 'Must have raised crests merging between the tines');
  console.log('   ✓ Multi-prong crest merging verified.');
}

// 4. Crossing Strokes Physics Test (Overriding, NOT translucent stacking)
{
  console.log('4. Testing Crossing Strokes (Physical Override, No Ribbon Overlap)...');
  const hf = new SandHeightfield(800, 600);

  // Stroke 1: Horizontal at y = 0.5
  hf.carveRakeSegment(
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 },
    [0],
    0.015,
    1.0
  );

  // Height at intersection (0.5, 0.5) was a trough
  const intersectIdx = 300 * 800 + 400;
  const hBeforeCross = hf.heights[intersectIdx];
  assert(hBeforeCross < -0.3, 'Pre-condition: intersection center must be in trough');

  // Stroke 2: Vertical crossing at x = 0.5 from y = 0.2 to y = 0.8
  hf.carveRakeSegment(
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.8 },
    [0],
    0.015,
    1.0
  );

  const hAfterCross = hf.heights[intersectIdx];
  // The crossing stroke cuts through cleanly
  assert(hAfterCross < -0.3, 'Crossing stroke maintains carved trough');

  // Check the berm of Stroke 1 where Stroke 2 cuts through:
  // Stroke 1 berm was at y = 0.5 +/- (radius + berm/2)
  const tineRadiusY = Math.round(0.015 * 0.6 * 599);
  const bermCellY = 300 + tineRadiusY + 3;
  // Where Stroke 2 passed (x = 0.5, y = bermCellY):
  // Stroke 2 carved through Stroke 1's berm!
  const cutBermIdx = bermCellY * 800 + 400;
  const cutBermH = hf.heights[cutBermIdx];
  assert(cutBermH < 0, 'Crossing tine must physically cut through previous berm');
  console.log(`   Cut berm height at intersection: ${cutBermH.toFixed(4)} (successfully carved through)`);
  console.log('   ✓ Crossing stroke physical override verified.');
}

// 5. Granular Angle of Repose & Settling Test
{
  console.log('5. Testing Granular Angle of Repose Settling...');
  const hf = new SandHeightfield(800, 600);

  // Manually create an unnaturally steep vertical spike
  const centerIdx = 300 * 800 + 400;
  hf.heights[centerIdx] = 1.0;
  hf.markAllDirty();

  const maxGradBefore = Math.abs(hf.heights[centerIdx] - hf.heights[centerIdx + 1]);
  assert(maxGradBefore === 1.0, 'Pre-condition: vertical step of 1.0');

  // Apply settling
  hf.applySettling(3, false);

  const maxGradAfter = Math.abs(hf.heights[centerIdx] - hf.heights[centerIdx + 1]);
  console.log(`   Max gradient before: ${maxGradBefore.toFixed(3)}, after settling: ${maxGradAfter.toFixed(3)}`);
  assert(maxGradAfter < maxGradBefore, 'Settling must reduce steep cliff gradient');
  assert(hf.heights[centerIdx + 1] > 0, 'Excess sand must avalanche to neighbors');
  console.log('   ✓ Angle of repose settling verified.');
}

// 6. Smoothing Tool Leveling & Diffusion Test
{
  console.log('6. Testing Smoothing Tool Leveling (Hira-Kushi)...');
  const hf = new SandHeightfield(800, 600);

  // Carve a deep groove
  hf.carveRakeSegment(
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
    [0],
    0.02,
    1.0
  );

  const centerIdx = 300 * 800 + 400;
  const hBeforeSmooth = hf.heights[centerIdx];
  assert(hBeforeSmooth < -0.3, 'Pre-condition: deep groove exists');

  // Smooth over the area multiple times
  for (let i = 0; i < 4; i++) {
    hf.smoothArea(0.5, 0.5, 0.05, 0.6);
  }

  const hAfterSmooth = hf.heights[centerIdx];
  console.log(`   Height before smooth: ${hBeforeSmooth.toFixed(4)}, after smooth: ${hAfterSmooth.toFixed(4)}`);
  assert(Math.abs(hAfterSmooth) < Math.abs(hBeforeSmooth) * 0.3, 'Smooth tool must level groove towards 0');
  console.log('   ✓ Smoothing tool leveling verified.');
}

// 7. Stone Obstacle & Clean Natural Sand Contact Test
{
  console.log('7. Testing Stone Obstacle Exclusion & Clean Natural Perimeter...');
  const hf = new SandHeightfield(800, 600);
  const testStone: GardenStone = {
    id: 'test-stone',
    type: 'dark-river',
    x: 0.5,
    y: 0.5,
    radiusX: 0.06,
    radiusY: 0.04,
    rotation: 0,
    seed: 12345
  };

  hf.addStoneContactBerms([testStone]);

  // Check sand at perimeter along X axis: artificial berm removed, sand remains pristine flat (height = 0)
  const rimGx = Math.round((0.5 + 0.065) * 799);
  const rimGy = Math.round(0.5 * 599);
  const rimIdx = rimGy * 800 + rimGx;
  const rimH = hf.heights[rimIdx];
  console.log(`   Perimeter height outside stone: ${rimH.toFixed(4)} (no artificial circular ridge)`);
  assert(rimH === 0, 'Sand must remain flat without artificial circular berms around stone');

  // Attempt to rake directly through stone
  hf.carveRakeSegment(
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
    [0],
    0.015,
    1.0,
    [testStone]
  );

  // Center of stone should NOT be carved out
  const stoneCenterIdx = 300 * 800 + 400;
  const stoneCenterH = hf.heights[stoneCenterIdx];
  assert(stoneCenterH >= 0, 'Stone center must not be carved into by tine');
  console.log('   ✓ Stone obstacle & clean natural perimeter verified.');
}

// 8. RakeEngine Integration, Undo/Redo & State Rebuild Test
{
  console.log('8. Testing RakeEngine Undo/Redo and Heightfield Synchronization...');
  const engine = new RakeEngine();

  // Draw a freehand stroke
  engine.onStrokeStart({ source: 'pointer', x: 0.2, y: 0.3 });
  engine.onStrokeMove({ source: 'pointer', x: 0.5, y: 0.3 });
  engine.onStrokeMove({ source: 'pointer', x: 0.8, y: 0.3 });
  engine.onStrokeEnd({ source: 'pointer', x: 0.8, y: 0.3 });

  assert(engine.getElements().length === 1, 'Engine must have 1 committed element');
  assert(engine.canUndo(), 'Engine must be able to undo');

  // Verify heightfield has negative trough
  const hf = engine.getHeightfield();
  const sampleIdx = Math.round(0.3 * (hf.height - 1)) * hf.width + Math.round(0.5 * (hf.width - 1));
  assert(hf.heights[sampleIdx] < -0.2, 'Heightfield must reflect stroke');

  // Test Undo
  const undoOk = engine.undo();
  assert(undoOk, 'Undo should succeed');
  assert(engine.getElements().length === 0, 'Elements should be empty after undo');
  assert(hf.heights[sampleIdx] === 0, 'Heightfield must be restored to flat on undo');

  // Test Redo
  const redoOk = engine.redo();
  assert(redoOk, 'Redo should succeed');
  assert(engine.getElements().length === 1, 'Elements should be 1 after redo');
  assert(hf.heights[sampleIdx] < -0.2, 'Heightfield must be restored on redo');

  console.log('   ✓ Engine Undo/Redo & Heightfield sync verified.');
}

// 9. Presets Simulation & Pattern Verification Test
{
  console.log('9. Testing Preset Patterns Carving into Heightfield...');
  const engine = new RakeEngine();

  for (const preset of GARDEN_PRESETS) {
    engine.setGardenState(preset.elements, preset.stones);
    const hf = engine.getHeightfield();

    let minH = 0;
    let maxH = 0;
    for (let i = 0; i < hf.heights.length; i++) {
      if (hf.heights[i] < minH) minH = hf.heights[i];
      if (hf.heights[i] > maxH) maxH = hf.heights[i];
    }

    console.log(`   Preset "${preset.name}": elements=${preset.elements.length}, minH=${minH.toFixed(3)}, maxH=${maxH.toFixed(3)}`);
    if (preset.elements.length > 0) {
      assert(minH < -0.2, `Preset "${preset.name}" must produce troughs`);
      assert(maxH > 0.1, `Preset "${preset.name}" must produce ridges`);
    }
  }
  console.log('   ✓ All Zen garden presets simulated successfully.');
}

// 10. Palette Parsing & Normal Computation Test
{
  console.log('10. Testing Palette Parsing and Surface Normals...');
  for (const [id, pal] of Object.entries(SAND_PALETTES)) {
    const base = parseColor(pal.baseColor);
    const trough = parseColor(pal.grooveTrough);
    const light = parseColor(pal.grainLight);
    assert(base.r >= 0 && base.r <= 255, `Base color R valid for ${id}`);
    assert(trough.r >= 0 && trough.r <= 255, `Trough color R valid for ${id}`);
    assert(light.r >= 0 && light.r <= 255, `Light color R valid for ${id}`);
  }

  const hf = new SandHeightfield(200, 200);
  hf.heights[100 * 200 + 101] = 0.5; // Slope in X
  const normal = [0, 0, 1];
  hf.getNormal(100, 100, normal);
  assert(normal[0] !== 0, 'Normal X must respond to slope');
  assert(normal[2] > 0, 'Normal Z must point upward');
  const nLen = Math.hypot(normal[0], normal[1], normal[2]);
  assert(Math.abs(nLen - 1.0) < 1e-4, 'Normal must be normalized unit vector');
  console.log('   ✓ Palette parsing and surface normals verified.');
}

// 11. Multi-Point Dense Stroke Berm Stability Test (Dense Sampling Protection)
{
  console.log('11. Testing Multi-Point Dense Stroke Berm Stability (Dense Sampling Protection)...');
  const hfSingle = new SandHeightfield(800, 600);
  hfSingle.carveRakeSegment({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, [0], 0.015, 1.0);

  const hfMulti = new SandHeightfield(800, 600);
  const steps = 100;
  for (let i = 0; i < steps; i++) {
    const x0 = 0.2 + (i / steps) * 0.6;
    const x1 = 0.2 + ((i + 1) / steps) * 0.6;
    hfMulti.carveRakeSegment({ x: x0, y: 0.5 }, { x: x1, y: 0.5 }, [0], 0.015, 1.0);
  }

  let maxSingle = 0;
  let maxMulti = 0;
  for (let i = 0; i < hfSingle.heights.length; i++) {
    if (hfSingle.heights[i] > maxSingle) maxSingle = hfSingle.heights[i];
    if (hfMulti.heights[i] > maxMulti) maxMulti = hfMulti.heights[i];
  }

  const ratio = maxMulti / maxSingle;
  console.log(`    Single segment max berm: ${maxSingle.toFixed(4)}, 100-segment: ${maxMulti.toFixed(4)}, ratio: ${ratio.toFixed(2)}`);
  assert(ratio >= 0.95 && ratio <= 1.25, `Multi-step berm ratio ${ratio.toFixed(2)} must be within [0.95, 1.25]`);
  console.log('   ✓ Dense stroke berm stability verified.');
}

// 12. Fast Movement Sub-stepping Sweeping Test
{
  console.log('12. Testing Fast Movement Sub-stepping Sweeping...');
  const engine = new RakeEngine();
  // Rapid flick across screen in a single move event
  engine.onStrokeStart({ source: 'pointer', x: 0.2, y: 0.5 });
  engine.onStrokeMove({ source: 'pointer', x: 0.8, y: 0.5 });
  engine.onStrokeEnd({ source: 'pointer', x: 0.8, y: 0.5 });

  const hf = engine.getHeightfield();
  // Check that intermediate points are carved without gaps
  for (let xCheck = 0.25; xCheck <= 0.75; xCheck += 0.05) {
    const gx = Math.round(xCheck * (hf.width - 1));
    const gy = Math.round(0.5 * (hf.height - 1));
    const h = hf.heights[gy * hf.width + gx];
    assert(h < -0.2, `Fast flick must carve continuous furrow at x=${xCheck.toFixed(2)} (got ${h.toFixed(3)})`);
  }
  console.log('   ✓ Fast movement sub-stepping sweeping verified.');
}

// 13. Isotropic Aspect Ratio Circularity Test
{
  console.log('13. Testing Isotropic Aspect Ratio True Circularity...');
  const hfWidescreen = new SandHeightfield(960, 540, 16 / 9);
  hfWidescreen.carveCirclePattern({
    id: 'test-circle',
    type: 'circle',
    centerX: 0.5,
    centerY: 0.5,
    innerRadius: 0.15,
    ringCount: 1,
    ringSpacing: 0.02,
    grooveWidth: 0.01,
    depth: 1.0
  });

  // Sample along horizontal axis (dx) and vertical axis (dy) from center
  const cx = 0.5;
  const cy = 0.5;
  const rExpected = 0.15;

  // Along X: distance in normalized coordinates is rExpected / aspect
  const testX = cx + rExpected / (16 / 9);
  const gxX = Math.round(testX * (hfWidescreen.width - 1));
  const gyCenter = Math.round(cy * (hfWidescreen.height - 1));
  const hX = hfWidescreen.heights[gyCenter * hfWidescreen.width + gxX];

  // Along Y: distance in normalized coordinates is rExpected
  const testY = cy + rExpected;
  const gxCenter = Math.round(cx * (hfWidescreen.width - 1));
  const gyY = Math.round(testY * (hfWidescreen.height - 1));
  const hY = hfWidescreen.heights[gyY * hfWidescreen.width + gxCenter];

  console.log(`    Height at horizontal ring apex: ${hX.toFixed(3)}, vertical ring apex: ${hY.toFixed(3)}`);
  assert(hX < -0.25, 'Horizontal ring must be carved to trough');
  assert(hY < -0.25, 'Vertical ring must be carved to trough');
  console.log('   ✓ Isotropic aspect ratio circularity verified.');
}

// 14. Real-time Physical Pattern Preview Test
{
  console.log('14. Testing Real-time Physical Pattern Preview...');
  const engine = new RakeEngine();
  engine.setTool('circle');

  // Start dragging a circle
  engine.onStrokeStart({ source: 'pointer', x: 0.5, y: 0.5 });
  engine.onStrokeMove({ source: 'pointer', x: 0.6, y: 0.5 });

  // While stroke is still active, getHeightfield() MUST return previewHeightfield with carved 3D sand
  const liveHf = engine.getHeightfield();
  let minLiveH = 0;
  for (let i = 0; i < liveHf.heights.length; i++) {
    if (liveHf.heights[i] < minLiveH) minLiveH = liveHf.heights[i];
  }
  assert(minLiveH < -0.2, 'Active pattern drag must simulate directly into physical heightfield');

  // Cancel stroke
  engine.onStrokeCancel('pointer');
  const canceledHf = engine.getHeightfield();
  let minCanceledH = 0;
  for (let i = 0; i < canceledHf.heights.length; i++) {
    if (canceledHf.heights[i] < minCanceledH) minCanceledH = canceledHf.heights[i];
  }
  assert(minCanceledH === 0, 'Cancelled pattern drag must leave base heightfield untouched');
  console.log('   ✓ Real-time physical pattern preview verified.');
}

// 15. 8-Neighbor Granular Repose Settling on Steep Step Test
{
  console.log('15. Testing 8-Neighbor Granular Repose Settling on Steep Step...');
  const hf = new SandHeightfield(200, 200);
  for (let y = 0; y < 200; y++) {
    for (let x = 100; x < 200; x++) {
      hf.heights[y * 200 + x] = 0.5;
    }
  }
  hf.markAllDirty();

  hf.applySettling(3, false);
  const centerStep = hf.heights[100 * 200 + 100] - hf.heights[100 * 200 + 99];
  console.log(`    Step after settling: ${centerStep.toFixed(4)} (relaxed from 0.500)`);
  assert(centerStep < 0.25, 'Steep vertical cliff must avalanche to natural repose angle');
  console.log('   ✓ 8-Neighbor granular repose settling verified.');
}

console.log('\n========================================');
console.log('🎉 ALL 15 COMPREHENSIVE TESTS PASSED! 🎉');
console.log('========================================');

