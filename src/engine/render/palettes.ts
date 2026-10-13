import { SandPalette, SandPaletteId } from '../../types/garden';

export const SAND_PALETTES: Record<SandPaletteId, SandPalette> = {
  'warm-ivory': {
    id: 'warm-ivory',
    name: 'Warm Ivory',
    baseColor: '#F7F4EC',
    grainDark: '#E8E2D4',
    grainLight: '#FDFBF7',
    grooveTrough: '#DFD6C4',
    grooveShadow: 'rgba(96, 86, 74, 0.18)',
    grooveHighlight: 'rgba(255, 253, 248, 0.70)',
    ambientLight: 'rgba(255, 252, 246, 0.12)'
  },
  'natural-sand': {
    id: 'natural-sand',
    name: 'Natural Sand',
    baseColor: '#EFE7D8',
    grainDark: '#E2D7C3',
    grainLight: '#FAF6EE',
    grooveTrough: '#D6C9B3',
    grooveShadow: 'rgba(92, 82, 68, 0.20)',
    grooveHighlight: 'rgba(255, 252, 244, 0.65)',
    ambientLight: 'rgba(255, 250, 240, 0.10)'
  },
  'pale-sand': {
    id: 'pale-sand',
    name: 'Pale Sand',
    baseColor: '#FAF8F5',
    grainDark: '#EDE9E1',
    grainLight: '#FFFFFF',
    grooveTrough: '#E2DDD3',
    grooveShadow: 'rgba(88, 85, 80, 0.15)',
    grooveHighlight: 'rgba(255, 255, 255, 0.75)',
    ambientLight: 'rgba(255, 255, 255, 0.12)'
  },
  'slate-sand': {
    id: 'slate-sand',
    name: 'Slate Sand',
    baseColor: '#E6E4DF',
    grainDark: '#D5D2CC',
    grainLight: '#F4F3F0',
    grooveTrough: '#C4C1B9',
    grooveShadow: 'rgba(72, 75, 80, 0.20)',
    grooveHighlight: 'rgba(255, 255, 255, 0.60)',
    ambientLight: 'rgba(248, 250, 252, 0.10)'
  },
  'moss-zen': {
    id: 'moss-zen',
    name: 'Moss Ground',
    baseColor: '#E8E7DC',
    grainDark: '#D6D7C7',
    grainLight: '#F6F6EE',
    grooveTrough: '#C5C7B5',
    grooveShadow: 'rgba(68, 76, 60, 0.18)',
    grooveHighlight: 'rgba(255, 255, 250, 0.62)',
    ambientLight: 'rgba(250, 254, 246, 0.10)'
  }
};
