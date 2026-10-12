import { BaseSandRenderer } from './BaseSandRenderer';
import { GrooveRenderer } from './GrooveRenderer';
import { StoneRenderer } from './StoneRenderer';
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

  constructor() {
    this.baseSandRenderer = new BaseSandRenderer();
    this.grooveRenderer = new GrooveRenderer();
    this.stoneRenderer = new StoneRenderer();
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
    selectedStoneId: string | null
  ) {
    const palette = SAND_PALETTES[paletteId] || SAND_PALETTES['warm-ivory'];

    ctx.save();
    // Scale for High-DPI crisp rendering
    ctx.scale(dpr, dpr);

    // 1. Procedural Sand Base Texture
    this.baseSandRenderer.render(ctx, width, height, palette);

    // 2. Committed Rake Grooves
    this.grooveRenderer.renderElements(ctx, elements, width, height, palette);

    // 3. Active in-progress stroke / pattern preview
    if (activeElement) {
      this.grooveRenderer.renderElement(ctx, activeElement, width, height, palette);
    }

    // 4. Procedural Stones (arranged naturally over sand)
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
    scale = 2
  ): string {
    const offscreen = document.createElement('canvas');
    offscreen.width = width * scale;
    offscreen.height = height * scale;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';

    this.render(
      ctx,
      width,
      height,
      scale,
      paletteId,
      elements,
      null,
      stones,
      null // No selection handles in export
    );

    return offscreen.toDataURL('image/png');
  }

  public getStoneRenderer(): StoneRenderer {
    return this.stoneRenderer;
  }
}
