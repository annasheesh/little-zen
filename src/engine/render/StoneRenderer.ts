import { GardenStone, StoneType } from '../../types/garden';

interface StoneStyle {
  baseColor: string;
  midColor: string;
  darkColor: string;
  highlightColor: string;
  rimColor: string;
  bounceColor: string;
  roughness: number;
}

const STONE_STYLES: Record<StoneType, StoneStyle> = {
  'dark-river': {
    baseColor: '#383733',
    midColor: '#282725',
    darkColor: '#181716',
    highlightColor: 'rgba(255, 255, 255, 0.28)',
    rimColor: 'rgba(255, 255, 255, 0.42)',
    bounceColor: 'rgba(242, 232, 218, 0.16)',
    roughness: 0.12
  },
  'slate': {
    baseColor: '#605e58',
    midColor: '#494843',
    darkColor: '#2c2b27',
    highlightColor: 'rgba(255, 255, 255, 0.22)',
    rimColor: 'rgba(255, 255, 255, 0.32)',
    bounceColor: 'rgba(240, 230, 215, 0.14)',
    roughness: 0.24
  },
  'granite': {
    baseColor: '#7c7a72',
    midColor: '#5d5b53',
    darkColor: '#383630',
    highlightColor: 'rgba(255, 255, 255, 0.30)',
    rimColor: 'rgba(255, 255, 255, 0.40)',
    bounceColor: 'rgba(242, 232, 218, 0.18)',
    roughness: 0.38
  },
  'weathered': {
    baseColor: '#a49a8b',
    midColor: '#7a7061',
    darkColor: '#4c4436',
    highlightColor: 'rgba(255, 255, 255, 0.32)',
    rimColor: 'rgba(255, 255, 255, 0.42)',
    bounceColor: 'rgba(245, 235, 220, 0.20)',
    roughness: 0.30
  },
  'pebble': {
    baseColor: '#4e4c47',
    midColor: '#383733',
    darkColor: '#22211e',
    highlightColor: 'rgba(255, 255, 255, 0.25)',
    rimColor: 'rgba(255, 255, 255, 0.35)',
    bounceColor: 'rgba(240, 230, 215, 0.15)',
    roughness: 0.14
  },
  'grounding': {
    baseColor: '#2d2c28',
    midColor: '#1e1d1a',
    darkColor: '#11100f',
    highlightColor: 'rgba(255, 255, 255, 0.20)',
    rimColor: 'rgba(255, 255, 255, 0.30)',
    bounceColor: 'rgba(240, 230, 215, 0.14)',
    roughness: 0.28
  }
};

/**
 * Computes deterministic organic radius multiplier for a stone at given local polar angle.
 * Accurately models authentic Japanese Zen garden stone silhouettes (Karesansui Ishi)
 * with natural river weathering, asymmetric mass, and gentle planar facets.
 */
export function getStoneRadiusFactor(
  seed: number,
  type: StoneType = 'dark-river',
  angle: number
): number {
  let s = (Math.abs(seed) % 2147483647) || 1234567;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Asymmetric dipole balance (w1): stones rest naturally with one side broader
  // Elliptic & shoulder contour (w2)
  // Planar weathered facets (w3, w4, w5)
  let w1 = 0.12, w2 = 0.08, w3 = 0.05, w4 = 0.03, w5 = 0.015;
  if (type === 'granite') {
    w1 = 0.13; w2 = 0.09; w3 = 0.07; w4 = 0.04; w5 = 0.02; // Sturdy mountain rock with natural facets
  } else if (type === 'slate') {
    w1 = 0.10; w2 = 0.14; w3 = 0.05; w4 = 0.03; w5 = 0.015; // Layered, oblong river plate
  } else if (type === 'pebble') {
    w1 = 0.07; w2 = 0.05; w3 = 0.03; w4 = 0.015; w5 = 0.01; // Smooth water-tumbled pebble
  } else if (type === 'weathered') {
    w1 = 0.14; w2 = 0.09; w3 = 0.06; w4 = 0.04; w5 = 0.02; // Weathered organic boulder
  } else if (type === 'grounding') {
    w1 = 0.15; w2 = 0.11; w3 = 0.06; w4 = 0.03; w5 = 0.02; // Anchor stone with heavy base
  }

  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  const p3 = rnd() * Math.PI * 2;
  const p4 = rnd() * Math.PI * 2;
  const p5 = rnd() * Math.PI * 2;

  const a1 = (rnd() * 0.4 + 0.8) * w1;
  const a2 = (rnd() * 0.4 + 0.8) * w2;
  const a3 = (rnd() * 0.4 + 0.8) * w3;
  const a4 = (rnd() * 0.4 + 0.8) * w4;
  const a5 = (rnd() * 0.4 + 0.8) * w5;

  return 1.0 +
    a1 * Math.cos(angle + p1) +
    a2 * Math.cos(2 * angle + p2) +
    a3 * Math.cos(3 * angle + p3) +
    a4 * Math.cos(4 * angle + p4) +
    a5 * Math.cos(5 * angle + p5);
}

export class StoneRenderer {
  /**
   * Renders a stone with contact shadow, ambient occlusion, 3D volumetric shading,
   * authentic mineral textures, sunward highlights, sand bounce, and organic moss.
   */
  public renderStone(
    ctx: CanvasRenderingContext2D,
    stone: GardenStone,
    width: number,
    height: number,
    isSelected: boolean = false
  ) {
    const minDim = Math.min(width, height);
    const cx = stone.x * width;
    const cy = stone.y * height;
    const rx = stone.radiusX * minDim;
    const ry = stone.radiusY * minDim;

    const style = STONE_STYLES[stone.type] || STONE_STYLES['dark-river'];
    const path = this.getStonePath(stone.seed, rx, ry, stone.type);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(stone.rotation);

    // 1. Soft directional cast shadow on sand bed (light from top-left, shadow to bottom-right)
    ctx.save();
    ctx.translate(rx * 0.09, ry * 0.13);
    ctx.scale(1.05, 1.05);
    ctx.filter = `blur(${Math.max(2.5, minDim * 0.008)}px)`;
    ctx.fillStyle = 'rgba(26, 20, 14, 0.26)';
    ctx.fill(path);
    ctx.restore();

    // 2. Deep contact ambient occlusion crevice (hugs rock base into sand grains)
    ctx.save();
    ctx.translate(rx * 0.02, ry * 0.03);
    ctx.filter = `blur(${Math.max(1.2, minDim * 0.003)}px)`;
    ctx.fillStyle = 'rgba(16, 12, 8, 0.48)';
    ctx.fill(path);
    ctx.restore();

    // 3. Volumetric stone base gradient (upper-left light to lower-right shadow)
    const baseGrad = ctx.createLinearGradient(-rx * 0.8, -ry * 0.8, rx * 0.8, ry * 0.8);
    baseGrad.addColorStop(0, style.baseColor);
    baseGrad.addColorStop(0.5, style.midColor);
    baseGrad.addColorStop(1, style.darkColor);
    ctx.fillStyle = baseGrad;
    ctx.fill(path);

    // 4. Directional 3D dome radial highlight (centered towards sunward facet)
    const domeGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, 0, 0, 0, Math.max(rx, ry));
    domeGrad.addColorStop(0, style.highlightColor);
    domeGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = domeGrad;
    ctx.fill(path);

    // 5. Procedural mineral textures & geological facets (clipped to stone body)
    ctx.save();
    ctx.clip(path);
    this.renderStoneTexture(ctx, stone, rx, ry);
    ctx.restore();

    // 6. Ambient sand bounce glow on shadowed underbelly (light reflected from bright sand bed)
    ctx.save();
    const bounceGrad = ctx.createRadialGradient(
      rx * 0.35,
      ry * 0.45,
      0,
      rx * 0.35,
      ry * 0.45,
      Math.max(rx, ry) * 0.85
    );
    bounceGrad.addColorStop(0, style.bounceColor);
    bounceGrad.addColorStop(0.65, 'rgba(240, 230, 215, 0.04)');
    bounceGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bounceGrad;
    ctx.fill(path);
    ctx.restore();

    // 7. Sunward rim glint along natural boundary curve (upper-left sunlight catch)
    ctx.save();
    const rimGrad = ctx.createLinearGradient(-rx * 0.9, -ry * 0.9, rx * 0.7, ry * 0.7);
    rimGrad.addColorStop(0, style.rimColor);
    rimGrad.addColorStop(0.35, style.highlightColor);
    rimGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(1.2, minDim * 0.0022);
    ctx.stroke(path);
    ctx.restore();

    // 7b. Delicate contact edge definition
    ctx.save();
    ctx.strokeStyle = style.darkColor;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    ctx.stroke(path);
    ctx.restore();

    // 8. Natural botanical moss patches nestled in crevices
    if (stone.moss && stone.moss.length > 0) {
      this.renderMossPatches(ctx, stone, rx, ry, path, minDim);
    }

    // 9. Selection boundary & manipulation handles
    if (isSelected) {
      this.renderSelectionOutline(ctx, path, rx, ry, minDim);
    }

    ctx.restore();
  }

  /**
   * Renders type-specific geological textures (granite flecks, slate strata, river sheen).
   */
  private renderStoneTexture(
    ctx: CanvasRenderingContext2D,
    stone: GardenStone,
    rx: number,
    ry: number
  ) {
    let s = (Math.abs(stone.seed) % 2147483647) || 1234567;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    const maxR = Math.max(rx, ry);

    // 1. Subtle planar facets / geological fracture planes across rock face
    const facetAngle = -0.55 + (rnd() - 0.5) * 0.35;
    const cosF = Math.cos(facetAngle);
    const sinF = Math.sin(facetAngle);
    const facetGrad = ctx.createLinearGradient(
      -rx * cosF, -ry * sinF,
      rx * cosF, ry * sinF
    );
    facetGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    facetGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0)');
    facetGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.12)');
    facetGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = facetGrad;
    ctx.fillRect(-rx * 1.5, -ry * 1.5, rx * 3, ry * 3);

    // 2. Type-specific geological textures
    switch (stone.type) {
      case 'granite': {
        // Mikage Granite: crystalline quartz, dark biotite, and feldspar flecks
        const speckleCount = Math.min(300, Math.floor(rx * ry * 0.07 + 130));
        for (let i = 0; i < speckleCount; i++) {
          const r = Math.sqrt(rnd()) * 0.94;
          const th = rnd() * Math.PI * 2;
          const fx = Math.cos(th) * rx * r;
          const fy = Math.sin(th) * ry * r;
          const speckleType = rnd();
          const sz = 0.8 + rnd() * 1.5;

          if (speckleType < 0.40) {
            // Dark biotite mica flecks
            ctx.fillStyle = `rgba(20, 20, 18, ${0.35 + rnd() * 0.35})`;
          } else if (speckleType < 0.75) {
            // Translucent quartz crystals
            ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + rnd() * 0.35})`;
          } else {
            // Pinkish buff feldspar grains
            ctx.fillStyle = `rgba(215, 190, 168, ${0.25 + rnd() * 0.30})`;
          }

          ctx.beginPath();
          ctx.arc(fx, fy, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'slate': {
        // Kurama Slate: parallel sedimentary strata / cleavage planes
        const strataCount = 10;
        const strataSpacing = (ry * 1.8) / strataCount;
        ctx.save();
        ctx.rotate(0.35); // Slanted sedimentary bedding
        for (let i = -strataCount; i <= strataCount; i++) {
          const sy = i * strataSpacing + (rnd() - 0.5) * 3;
          ctx.strokeStyle = i % 2 === 0
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(12, 12, 10, 0.16)';
          ctx.lineWidth = 1.0 + rnd() * 1.5;
          ctx.beginPath();
          ctx.moveTo(-rx * 1.6, sy);
          ctx.lineTo(rx * 1.6, sy + (rnd() - 0.5) * 4);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'dark-river': {
        // Kamogawa Basalt: water-polished river rock satin striations and mottled mineral patches
        const patchCount = 6;
        for (let i = 0; i < patchCount; i++) {
          const px = (rnd() - 0.5) * rx * 1.2;
          const py = (rnd() - 0.5) * ry * 1.2;
          const pr = (0.2 + rnd() * 0.35) * maxR;
          const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
          patchGrad.addColorStop(0, 'rgba(16, 16, 15, 0.22)');
          patchGrad.addColorStop(1, 'rgba(16, 16, 15, 0)');
          ctx.fillStyle = patchGrad;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        // Fine polished micro-sheen
        const sheen = ctx.createLinearGradient(-rx * 0.6, -ry * 0.8, rx * 0.6, ry * 0.4);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
        sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(-rx * 1.5, -ry * 1.5, rx * 3, ry * 3);
        break;
      }

      case 'weathered': {
        // Weathered Boulder: porous earthy patches & mineral oxidization
        const patchCount = 7;
        for (let i = 0; i < patchCount; i++) {
          const px = (rnd() - 0.5) * rx * 1.3;
          const py = (rnd() - 0.5) * ry * 1.3;
          const pr = (0.2 + rnd() * 0.4) * maxR;
          const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
          patchGrad.addColorStop(0, 'rgba(145, 115, 80, 0.20)');
          patchGrad.addColorStop(0.6, 'rgba(100, 80, 55, 0.10)');
          patchGrad.addColorStop(1, 'rgba(100, 80, 55, 0)');
          ctx.fillStyle = patchGrad;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        // Micro-porous stipples
        for (let i = 0; i < 80; i++) {
          const fx = (rnd() - 0.5) * rx * 1.5;
          const fy = (rnd() - 0.5) * ry * 1.5;
          ctx.fillStyle = rnd() > 0.5 ? 'rgba(50, 40, 30, 0.20)' : 'rgba(255, 255, 255, 0.10)';
          ctx.beginPath();
          ctx.arc(fx, fy, 0.8 + rnd() * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'pebble': {
        // River Pebble: subtle smooth translucent inner depth
        const pDome = ctx.createRadialGradient(-rx * 0.15, -ry * 0.2, 0, 0, 0, maxR * 0.7);
        pDome.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
        pDome.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
        ctx.fillStyle = pDome;
        ctx.fillRect(-rx * 1.5, -ry * 1.5, rx * 3, ry * 3);
        break;
      }

      case 'grounding': {
        // Heavy Grounding Rock: dense basalt with subtle micro-fissures
        for (let i = 0; i < 4; i++) {
          const fx0 = (rnd() - 0.5) * rx;
          const fy0 = (rnd() - 0.5) * ry;
          ctx.strokeStyle = 'rgba(10, 10, 8, 0.32)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(fx0, fy0);
          ctx.lineTo(fx0 + (rnd() - 0.5) * rx * 0.45, fy0 + (rnd() - 0.5) * ry * 0.45);
          ctx.stroke();
        }
        break;
      }
    }
  }

  /**
   * Renders natural botanical moss patches nestled in stone crevices.
   */
  private renderMossPatches(
    ctx: CanvasRenderingContext2D,
    stone: GardenStone,
    rx: number,
    ry: number,
    stonePath: Path2D,
    minDim: number
  ) {
    if (!stone.moss || stone.moss.length === 0) return;

    ctx.save();
    ctx.clip(stonePath);

    for (const m of stone.moss) {
      const mx = m.offsetX * rx;
      const my = m.offsetY * ry;
      const baseR = m.radius * minDim;
      const opacity = m.opacity || 0.75;

      // Multi-lobed natural moss cluster
      const lobeCount = 5;
      for (let i = 0; i < lobeCount; i++) {
        const angle = (i / lobeCount) * Math.PI * 2;
        const dist = baseR * (0.32 + 0.15 * Math.sin(i * 2.5));
        const lx = mx + Math.cos(angle) * dist;
        const ly = my + Math.sin(angle) * dist;
        const lr = baseR * (0.55 + 0.2 * Math.cos(i * 3.1));

        // 1. Deep forest shadow under-layer
        const baseGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        baseGrad.addColorStop(0, `rgba(28, 38, 20, ${opacity * 0.85})`);
        baseGrad.addColorStop(0.7, `rgba(45, 60, 30, ${opacity * 0.6})`);
        baseGrad.addColorStop(1, 'rgba(45, 60, 30, 0)');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();

        // 2. Luminous matcha / spring lichen highlights on sunward crest of moss
        const hlGrad = ctx.createRadialGradient(lx - lr * 0.25, ly - lr * 0.25, 0, lx, ly, lr * 0.8);
        hlGrad.addColorStop(0, `rgba(125, 148, 80, ${opacity * 0.75})`);
        hlGrad.addColorStop(0.6, `rgba(80, 105, 52, ${opacity * 0.4})`);
        hlGrad.addColorStop(1, 'rgba(80, 105, 52, 0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, lr * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Micro botanical stippling for velvet moss texture
      for (let s = 0; s < 18; s++) {
        const sr = (Math.sin(s * 1.7) * 0.5 + 0.5) * baseR * 0.75;
        const sa = s * 0.85;
        const sx = mx + Math.cos(sa) * sr;
        const sy = my + Math.sin(sa) * sr;
        ctx.fillStyle = s % 2 === 0
          ? `rgba(140, 165, 95, ${opacity * 0.65})`
          : `rgba(22, 32, 16, ${opacity * 0.55})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.9 + (s % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Generates organic, smooth river stone polygon path from seed using continuous harmonic perturbation.
   * Eliminates sterile ellipses for authentic Japanese Zen garden stone silhouettes.
   */
  public getStonePath(seed: number, rx: number, ry: number, type: StoneType = 'dark-river'): Path2D {
    const path = new Path2D();
    const numPoints = 48;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rFactor = getStoneRadiusFactor(seed, type, angle);
      const x = Math.cos(angle) * rx * rFactor;
      const y = Math.sin(angle) * ry * rFactor;
      points.push({ x, y });
    }

    // Smooth closed quadratic spline through midpoints
    const startX = (points[0].x + points[numPoints - 1].x) * 0.5;
    const startY = (points[0].y + points[numPoints - 1].y) * 0.5;
    path.moveTo(startX, startY);
    for (let i = 0; i < numPoints; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % numPoints];
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;
      path.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    path.closePath();

    return path;
  }

  private renderSelectionOutline(
    ctx: CanvasRenderingContext2D,
    _path: Path2D,
    rx: number,
    ry: number,
    minDim: number
  ) {
    ctx.save();
    // Bounding selection box with refined dash
    ctx.strokeStyle = '#77806A';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-rx * 1.15, -ry * 1.15, rx * 2.3, ry * 2.3);

    // Scale handle at bottom right
    const handleSize = Math.max(7, minDim * 0.015);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#34332F';
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;

    // Corner handle (scale)
    ctx.beginPath();
    ctx.arc(rx * 1.15, ry * 1.15, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Top handle (rotate)
    ctx.beginPath();
    ctx.moveTo(0, -ry * 1.15);
    ctx.lineTo(0, -ry * 1.15 - 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -ry * 1.15 - 16, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Hit test to see if a garden coordinate is inside a stone.
   * Evaluates the authentic organic silhouette matching getStonePath.
   */
  public isPointInside(
    stone: GardenStone,
    ptX: number,
    ptY: number,
    width: number,
    height: number
  ): boolean {
    const minDim = Math.min(width, height);
    const cx = stone.x * width;
    const cy = stone.y * height;
    const rx = stone.radiusX * minDim;
    const ry = stone.radiusY * minDim;

    // Transform to local stone coordinates
    const dx = ptX * width - cx;
    const dy = ptY * height - cy;

    const cos = Math.cos(-stone.rotation);
    const sin = Math.sin(-stone.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const angle = Math.atan2(localY / ry, localX / rx);
    const rFactor = getStoneRadiusFactor(stone.seed, stone.type, angle);
    const normDist = Math.hypot(localX / rx, localY / ry) / rFactor;

    return normDist <= 1.08;
  }
}
