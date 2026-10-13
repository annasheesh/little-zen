import { BaseSandRenderer } from './BaseSandRenderer';
import { GrooveRenderer } from './GrooveRenderer';
import { StoneRenderer } from './StoneRenderer';
import { SandFieldRenderer } from './SandFieldRenderer';
import { SandHeightfield } from '../simulation/SandHeightfield';
import { SAND_PALETTES } from './palettes';
import {
  GardenGrooveElement,
  GardenStone,
  SandPaletteId
} from '../../types/garden';

export class GardenRenderer {
  private baseSandRenderer: BaseSandRenderer;
  private grooveRenderer: GrooveRenderer;
  private stoneRenderer: StoneRenderer;
  private sandFieldRenderer: SandFieldRenderer;
  private internalHeightfield: SandHeightfield;
  private lastElementCount = -1;
  private lastStoneCount = -1;

  constructor() {
    this.baseSandRenderer = new BaseSandRenderer();
    this.grooveRenderer = new GrooveRenderer();
    this.stoneRenderer = new StoneRenderer();
    this.sandFieldRenderer = new SandFieldRenderer();
    this.internalHeightfield = new SandHeightfield(1024, 768);
  }

  /**
   * Main render pass for the Zen Garden
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number,
    paletteId: SandPaletteId,
    elements: GardenGrooveElement[],
    activeElement: GardenGrooveElement | null,
    stones: GardenStone[],
    selectedStoneId: string | null,
    heightfield?: SandHeightfield
  ) {
    const palette = SAND_PALETTES[paletteId] || SAND_PALETTES['warm-ivory'];

    ctx.save();
    // Scale for High-DPI crisp rendering
    ctx.scale(dpr, dpr);

    // 1. Determine active heightfield
    let hf = heightfield;
    if (!hf) {
      if (
        this.lastElementCount !== elements.length ||
        this.lastStoneCount !== stones.length
      ) {
        this.internalHeightfield.rebuild(elements, stones);
        this.lastElementCount = elements.length;
        this.lastStoneCount = stones.length;
      }
      hf = this.internalHeightfield;
    }

    if (width > 0 && height > 0) {
      hf.setAspectRatio(width / height);
    }

    // 2. Render Physical 3D Granular Sand Bed (normals, diffuse, shadow, AO, micro-grain)
    // Note: all tools (rake, smooth, circle, line, wave, spiral) are simulated in 3D directly in the heightfield!
    this.sandFieldRenderer.render(ctx, hf, width, height, palette, dpr);

    // 4. Procedural Stones (arranged naturally over sand bed with contact berms)
    for (const stone of stones) {
      const isSelected = stone.id === selectedStoneId;
      this.stoneRenderer.renderStone(ctx, stone, width, height, isSelected);
    }

    ctx.restore();
  }

  /**
   * Exports high-resolution standalone PNG of the garden without UI
   */
  public exportGardenPNG(
    width: number,
    height: number,
    paletteId: SandPaletteId,
    elements: GardenGrooveElement[],
    stones: GardenStone[],
    scale = 2,
    sourceHeightfield?: SandHeightfield
  ): string {
    const offscreen = document.createElement('canvas');
    offscreen.width = width * scale;
    offscreen.height = height * scale;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';

    let exportField = sourceHeightfield;
    if (!exportField) {
      exportField = new SandHeightfield(
        Math.min(2048, Math.floor(width * scale)),
        Math.min(1536, Math.floor(height * scale))
      );
      exportField.rebuild(elements, stones);
    }

    this.render(
      ctx,
      width,
      height,
      scale,
      paletteId,
      elements,
      null,
      stones,
      null, // No selection handles in export
      exportField
    );

    return offscreen.toDataURL('image/png');
  }

  public getStoneRenderer(): StoneRenderer {
    return this.stoneRenderer;
  }

  public getSandFieldRenderer(): SandFieldRenderer {
    return this.sandFieldRenderer;
  }
}
