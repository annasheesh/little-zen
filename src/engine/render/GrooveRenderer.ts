import {
  GardenGrooveElement,
  FreehandStroke,
  CirclePattern,
  LinePattern,
  WavePattern,
  SpiralPattern,
  SandPalette,
  Point
} from '../../types/garden';

export class GrooveRenderer {
  /**
   * Renders a list of groove elements onto the canvas.
   */
  public renderElements(
    ctx: CanvasRenderingContext2D,
    elements: GardenGrooveElement[],
    width: number,
    height: number,
    palette: SandPalette
  ) {
    for (const elem of elements) {
      this.renderElement(ctx, elem, width, height, palette);
    }
  }

  public renderElement(
    ctx: CanvasRenderingContext2D,
    elem: GardenGrooveElement,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    ctx.save();
    switch (elem.type) {
      case 'freehand':
        this.renderFreehand(ctx, elem, width, height, palette);
        break;
      case 'circle':
        this.renderCircle(ctx, elem, width, height, palette);
        break;
      case 'line':
        this.renderLine(ctx, elem, width, height, palette);
        break;
      case 'wave':
        this.renderWave(ctx, elem, width, height, palette);
        break;
      case 'spiral':
        this.renderSpiral(ctx, elem, width, height, palette);
        break;
      case 'smooth':
        // Smooth/eraser brush is handled via destination blending or sand restoration
        break;
    }
    ctx.restore();
  }

  /**
   * Render Freehand multi-tine rake stroke with smooth splines and layered shading.
   */
  private renderFreehand(
    ctx: CanvasRenderingContext2D,
    stroke: FreehandStroke,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    if (stroke.points.length < 2) return;

    const baseWidth = Math.max(1.5, stroke.grooveWidth * Math.min(width, height));
    const prongs = stroke.prongOffsets.length > 0 ? stroke.prongOffsets : [0];

    // Compute parallel paths for each tine
    for (const offset of prongs) {
      const prongPixelOffset = offset * Math.min(width, height);
      const points = this.getOffsetPath(stroke.points, prongPixelOffset, width, height);
      if (points.length < 2) continue;

      this.renderGroovePath(ctx, points, baseWidth, stroke.depth, palette);
    }
  }

  /**
   * Generates offset points along the perpendicular normals of the stroke path.
   */
  private getOffsetPath(
    points: Point[],
    offsetDist: number,
    width: number,
    height: number
  ): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    if (points.length < 2) return result;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = p.x * width;
      const py = p.y * height;

      if (offsetDist === 0) {
        result.push({ x: px, y: py });
        continue;
      }

      // Compute tangent
      let dx = 0;
      let dy = 0;
      if (i === 0) {
        dx = points[1].x * width - px;
        dy = points[1].y * height - py;
      } else if (i === points.length - 1) {
        dx = px - points[i - 1].x * width;
        dy = py - points[i - 1].y * height;
      } else {
        dx = points[i + 1].x * width - points[i - 1].x * width;
        dy = points[i + 1].y * height - points[i - 1].y * height;
      }

      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      result.push({
        x: px + nx * offsetDist,
        y: py + ny * offsetDist
      });
    }

    return result;
  }

  /**
   * Renders a single carved groove path with recessed 3D sand shading:
   * 1. Soft deep shadow on bottom-right edge
   * 2. Recessed trough center
   * 3. Crisp warm highlight on upper-left edge
   */
  private renderGroovePath(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    strokeWidth: number,
    depth: number,
    palette: SandPalette
  ) {
    if (points.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Light vector from upper-left (-0.707, -0.707) -> Shadow offset towards (+1.2, +1.2)
    const shadowDist = Math.max(0.75, strokeWidth * 0.28 * depth);
    const highlightDist = Math.max(0.75, strokeWidth * 0.25 * depth);

    // 1. Recessed soft shadow pass (offset toward bottom-right)
    ctx.save();
    ctx.translate(shadowDist, shadowDist);
    ctx.beginPath();
    this.traceSpline(ctx, points);
    ctx.strokeStyle = palette.grooveShadow;
    ctx.lineWidth = strokeWidth * 1.35;
    ctx.stroke();
    ctx.restore();

    // 2. Central trough pass (darkened groove trench)
    ctx.save();
    ctx.beginPath();
    this.traceSpline(ctx, points);
    ctx.strokeStyle = palette.grooveTrough;
    ctx.lineWidth = strokeWidth * 0.95;
    ctx.stroke();
    ctx.restore();

    // 3. Highlight pass on upper-left ridge (offset toward top-left)
    ctx.save();
    ctx.translate(-highlightDist, -highlightDist);
    ctx.beginPath();
    this.traceSpline(ctx, points);
    ctx.strokeStyle = palette.grooveHighlight;
    ctx.lineWidth = strokeWidth * 0.45;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth cardinal / cubic spline interpolation through points
   */
  private traceSpline(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      // Catmull-Rom to cubic Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  /**
   * Render Concentric Circles pattern with directional lighting
   */
  private renderCircle(
    ctx: CanvasRenderingContext2D,
    pattern: CirclePattern,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    const cx = pattern.centerX * width;
    const cy = pattern.centerY * height;
    const minDim = Math.min(width, height);
    const strokeWidth = Math.max(1.5, pattern.grooveWidth * minDim);
    const spacing = pattern.ringSpacing * minDim;
    const startR = pattern.innerRadius * minDim;

    for (let i = 0; i < pattern.ringCount; i++) {
      const r = startR + i * spacing;
      if (r <= 0) continue;

      const shadowOffset = strokeWidth * 0.25 * pattern.depth;
      const highlightOffset = strokeWidth * 0.22 * pattern.depth;

      // 1. Soft Shadow (offset +X, +Y)
      ctx.beginPath();
      ctx.arc(cx + shadowOffset, cy + shadowOffset, r, 0, Math.PI * 2);
      ctx.strokeStyle = palette.grooveShadow;
      ctx.lineWidth = strokeWidth * 1.3;
      ctx.stroke();

      // 2. Central trough
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = palette.grooveTrough;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // 3. Highlight (offset -X, -Y)
      ctx.beginPath();
      ctx.arc(cx - highlightOffset, cy - highlightOffset, r, 0, Math.PI * 2);
      ctx.strokeStyle = palette.grooveHighlight;
      ctx.lineWidth = strokeWidth * 0.45;
      ctx.stroke();
    }
  }

  /**
   * Render Clean Parallel Lines
   */
  private renderLine(
    ctx: CanvasRenderingContext2D,
    pattern: LinePattern,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    const sx = pattern.startX * width;
    const sy = pattern.startY * height;
    const ex = pattern.endX * width;
    const ey = pattern.endY * height;
    const minDim = Math.min(width, height);
    const strokeWidth = Math.max(1.5, pattern.grooveWidth * minDim);
    const spacing = pattern.lineSpacing * minDim;

    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const half = (pattern.lineCount - 1) / 2;

    for (let i = 0; i < pattern.lineCount; i++) {
      const offset = (i - half) * spacing;
      const p1 = { x: sx + nx * offset, y: sy + ny * offset };
      const p2 = { x: ex + nx * offset, y: ey + ny * offset };

      this.renderGroovePath(ctx, [p1, p2], strokeWidth, pattern.depth, palette);
    }
  }

  /**
   * Render Harmonic Wave pattern
   */
  private renderWave(
    ctx: CanvasRenderingContext2D,
    pattern: WavePattern,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    const sx = pattern.startX * width;
    const sy = pattern.startY * height;
    const ex = pattern.endX * width;
    const ey = pattern.endY * height;
    const minDim = Math.min(width, height);
    const strokeWidth = Math.max(1.5, pattern.grooveWidth * minDim);
    const spacing = pattern.lineSpacing * minDim;
    const amp = pattern.amplitude * minDim;

    const dx = ex - sx;
    const dy = ey - sy;
    const totalDist = Math.hypot(dx, dy) || 1;
    const ux = dx / totalDist;
    const uy = dy / totalDist;
    const nx = -uy;
    const ny = ux;

    const half = (pattern.lineCount - 1) / 2;
    const steps = Math.max(20, Math.floor(totalDist / 4));

    for (let line = 0; line < pattern.lineCount; line++) {
      const lineOffset = (line - half) * spacing;
      const points: { x: number; y: number }[] = [];

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const currentDist = t * totalDist;
        const waveOffset = Math.sin(t * Math.PI * 2 * pattern.frequency) * amp;

        const px = sx + ux * currentDist + nx * (lineOffset + waveOffset);
        const py = sy + uy * currentDist + ny * (lineOffset + waveOffset);
        points.push({ x: px, y: py });
      }

      this.renderGroovePath(ctx, points, strokeWidth, pattern.depth, palette);
    }
  }

  /**
   * Render Archimedean Spiral pattern
   */
  private renderSpiral(
    ctx: CanvasRenderingContext2D,
    pattern: SpiralPattern,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    const cx = pattern.centerX * width;
    const cy = pattern.centerY * height;
    const minDim = Math.min(width, height);
    const maxR = pattern.radius * minDim;
    const strokeWidth = Math.max(1.5, pattern.grooveWidth * minDim);
    const totalAngle = pattern.turns * Math.PI * 2;
    const steps = Math.max(50, Math.floor(pattern.turns * 60));

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * totalAngle;
      const r = t * maxR;

      points.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      });
    }

    this.renderGroovePath(ctx, points, strokeWidth, pattern.depth, palette);
  }
}
