import { GardenStone, StoneType } from '../../types/garden';

interface StoneStyle {
  baseColor: string;
  darkColor: string;
  highlightColor: string;
  rimColor: string;
  roughness: number;
}

const STONE_STYLES: Record<StoneType, StoneStyle> = {
  'dark-river': {
    baseColor: '#34332F',
    darkColor: '#1E1E1C',
    highlightColor: 'rgba(255, 255, 255, 0.22)',
    rimColor: 'rgba(255, 255, 255, 0.35)',
    roughness: 0.12
  },
  'slate': {
    baseColor: '#62615A',
    darkColor: '#3F3E3A',
    highlightColor: 'rgba(255, 255, 255, 0.18)',
    rimColor: 'rgba(255, 255, 255, 0.28)',
    roughness: 0.22
  },
  'granite': {
    baseColor: '#7A7870',
    darkColor: '#4A4842',
    highlightColor: 'rgba(255, 255, 255, 0.24)',
    rimColor: 'rgba(255, 255, 255, 0.32)',
    roughness: 0.35
  },
  'weathered': {
    baseColor: '#A89F91',
    darkColor: '#686054',
    highlightColor: 'rgba(255, 255, 255, 0.30)',
    rimColor: 'rgba(255, 255, 255, 0.40)',
    roughness: 0.28
  },
  'pebble': {
    baseColor: '#4A4944',
    darkColor: '#2B2A27',
    highlightColor: 'rgba(255, 255, 255, 0.20)',
    rimColor: 'rgba(255, 255, 255, 0.30)',
    roughness: 0.15
  },
  'grounding': {
    baseColor: '#2A2926',
    darkColor: '#171614',
    highlightColor: 'rgba(255, 255, 255, 0.16)',
    rimColor: 'rgba(255, 255, 255, 0.26)',
    roughness: 0.25
  }
};

export class StoneRenderer {
  /**
   * Renders a stone with contact shadow, ambient occlusion, 3D shading, highlights, and moss.
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
    const path = this.getStonePath(stone.seed, rx, ry);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(stone.rotation);

    // 1. Soft contact shadow beneath stone (offset towards +X, +Y for upper-left light)
    ctx.save();
    ctx.translate(rx * 0.14, ry * 0.18);
    ctx.scale(1.06, 1.04);
    ctx.filter = `blur(${Math.max(3, minDim * 0.01)}px)`;
    ctx.fillStyle = 'rgba(34, 28, 22, 0.24)';
    ctx.fill(path);
    ctx.restore();

    // 2. Deep ambient occlusion contact rim (close drop shadow)
    ctx.save();
    ctx.translate(rx * 0.04, ry * 0.06);
    ctx.filter = `blur(${Math.max(1.5, minDim * 0.004)}px)`;
    ctx.fillStyle = 'rgba(20, 16, 12, 0.36)';
    ctx.fill(path);
    ctx.restore();

    // 3. Stone body base gradient
    const grad = ctx.createLinearGradient(-rx * 0.8, -ry * 0.8, rx * 0.8, ry * 0.8);
    grad.addColorStop(0, style.baseColor);
    grad.addColorStop(1, style.darkColor);
    ctx.fillStyle = grad;
    ctx.fill(path);

    // 4. Subtle dome-like 3D radial shading
    const radial = ctx.createRadialGradient(-rx * 0.25, -ry * 0.35, 0, 0, 0, Math.max(rx, ry));
    radial.addColorStop(0, style.highlightColor);
    radial.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = radial;
    ctx.fill(path);

    // 5. Upper-left soft sunward rim glint along natural stone boundary curve (no artificial circle arc)
    ctx.save();
    const rimGrad = ctx.createLinearGradient(-rx * 0.85, -ry * 0.85, rx * 0.6, ry * 0.6);
    rimGrad.addColorStop(0, style.rimColor);
    rimGrad.addColorStop(0.35, style.highlightColor);
    rimGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(1.2, minDim * 0.0025);
    ctx.stroke(path);
    ctx.restore();

    // 5b. Hairline edge smoothing to prevent any sub-pixel aliasing roughness
    ctx.save();
    ctx.strokeStyle = style.darkColor;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    ctx.stroke(path);
    ctx.restore();

    // 6. Moss patches (if any)
    if (stone.moss && stone.moss.length > 0) {
      ctx.save();
      ctx.clip(path);
      for (const m of stone.moss) {
        const mx = m.offsetX * rx;
        const my = m.offsetY * ry;
        const mr = m.radius * minDim;
        const mossGrad = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        mossGrad.addColorStop(0, `rgba(119, 128, 106, ${m.opacity})`);
        mossGrad.addColorStop(0.7, `rgba(85, 95, 75, ${m.opacity * 0.7})`);
        mossGrad.addColorStop(1, 'rgba(85, 95, 75, 0)');
        ctx.fillStyle = mossGrad;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. Selection boundary & manipulation handles
    if (isSelected) {
      this.renderSelectionOutline(ctx, path, rx, ry, minDim);
    }

    ctx.restore();
  }

  /**
   * Generates organic, smooth river stone polygon path from seed using continuous harmonic perturbation.
   * Eliminates jagged corners and rough polygonal edges for silky smooth, naturally weathered river stones.
   */
  public getStonePath(seed: number, rx: number, ry: number): Path2D {
    const path = new Path2D();
    const numPoints = 48;
    const points: { x: number; y: number }[] = [];

    // Deterministic pseudo-random number generator
    let s = (Math.abs(seed) % 2147483647) || 1234567;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    // Low-frequency harmonic decomposition (smooth macro variation, 0% high-frequency roughness)
    const a2 = (rnd() - 0.5) * 0.09;
    const phi2 = rnd() * Math.PI * 2;
    const a3 = (rnd() - 0.5) * 0.045;
    const phi3 = rnd() * Math.PI * 2;
    const a4 = (rnd() - 0.5) * 0.02;
    const phi4 = rnd() * Math.PI * 2;

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rFactor = 1.0 + a2 * Math.cos(2 * angle + phi2) + a3 * Math.cos(3 * angle + phi3) + a4 * Math.cos(4 * angle + phi4);
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
   * Hit test to see if a garden coordinate is inside a stone
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
    const rx = stone.radiusX * minDim * 1.1;
    const ry = stone.radiusY * minDim * 1.1;

    // Transform to local stone coordinates
    const dx = ptX * width - cx;
    const dy = ptY * height - cy;

    const cos = Math.cos(-stone.rotation);
    const sin = Math.sin(-stone.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Normalized ellipse distance
    return (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1.0;
  }
}
