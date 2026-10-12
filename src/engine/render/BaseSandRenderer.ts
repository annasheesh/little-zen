import { SandPalette } from '../../types/garden';

export class BaseSandRenderer {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private cachedWidth = 0;
  private cachedHeight = 0;
  private cachedPaletteId = '';

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    palette: SandPalette
  ) {
    if (
      this.cachedWidth !== width ||
      this.cachedHeight !== height ||
      this.cachedPaletteId !== palette.id
    ) {
      this.generateTexture(width, height, palette);
    }

    if (this.offscreenCanvas.width > 0 && this.offscreenCanvas.height > 0) {
      ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
  }

  private generateTexture(width: number, height: number, palette: SandPalette) {
    this.cachedWidth = width;
    this.cachedHeight = height;
    this.cachedPaletteId = palette.id;

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    if (!this.offscreenCtx) return;
    const ctx = this.offscreenCtx;

    // 1. Base wash with subtle soft ambient light gradient (simulating light from upper-left corner)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, palette.grainLight);
    bgGrad.addColorStop(0.35, palette.baseColor);
    bgGrad.addColorStop(1, palette.grainDark);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Soft large-scale natural tonal waves (cloudy variations)
    // We draw several large low-opacity radial shapes
    const numClouds = 12;
    // Deterministic PRNG for consistent texture
    let seed = 1234567;
    const rnd = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    ctx.save();
    for (let i = 0; i < numClouds; i++) {
      const cx = rnd() * width;
      const cy = rnd() * height;
      const r = Math.min(width, height) * (0.3 + rnd() * 0.4);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const isLighter = rnd() > 0.5;
      grad.addColorStop(0, isLighter ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Fine grain variation using ImageData for authentic micro-texture
    // We downscale grain generation to tile or step if large, or direct fast 1-pass loop
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const totalPixels = width * height;

      // Subtle noise variation (-5 to +5 on RGB channels)
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        // Fast pseudo random grain
        const n = ((rnd() - 0.5) * 10);
        data[offset] = Math.min(255, Math.max(0, data[offset] + n));
        data[offset + 1] = Math.min(255, Math.max(0, data[offset + 1] + n));
        data[offset + 2] = Math.min(255, Math.max(0, data[offset + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Fallback if getImageData restricted
    }
  }
}
