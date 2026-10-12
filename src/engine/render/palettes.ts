import { SandPalette, SandPaletteId } from '../../types/garden';

export const SAND_PALETTES: Record<SandPaletteId, SandPalette> = {
  'warm-ivory': {
    id: 'warm-ivory',
    name: 'Warm Ivory',
    baseColor: '#F3EDE2',
    grainDark: '#C8B89D',
    grainLight: '#F8F3E9',
    grooveTrough: '#B6A487',
    grooveShadow: 'rgba(60, 48, 30, 0.35)',
    grooveHighlight: 'rgba(255, 252, 245, 0.75)',
    ambientLight: 'rgba(255, 250, 240, 0.08)'
  },
  'natural-sand': {
    id: 'natural-sand',
    name: 'Natural Sand',
    baseColor: '#E8DCC7',
    grainDark: '#BAA98E',
    grainLight: '#F4ECE0',
    grooveTrough: '#A39276',
    grooveShadow: 'rgba(55, 42, 26, 0.40)',
    grooveHighlight: 'rgba(255, 250, 240, 0.70)',
    ambientLight: 'rgba(255, 248, 235, 0.08)'
  },
  'pale-sand': {
    id: 'pale-sand',
    name: 'Pale Sand',
    baseColor: '#F8F4EC',
    grainDark: '#D5C9B3',
    grainLight: '#FFFFFF',
    grooveTrough: '#C6B79D',
    grooveShadow: 'rgba(70, 58, 42, 0.30)',
    grooveHighlight: 'rgba(255, 255, 255, 0.85)',
    ambientLight: 'rgba(255, 255, 255, 0.10)'
  },
  'slate-sand': {
    id: 'slate-sand',
    name: 'Slate Sand',
    baseColor: '#D9D5CD',
    grainDark: '#A8A39B',
    grainLight: '#ECE8E1',
    grooveTrough: '#918C83',
    grooveShadow: 'rgba(40, 42, 45, 0.40)',
    grooveHighlight: 'rgba(255, 255, 255, 0.65)',
    ambientLight: 'rgba(240, 242, 245, 0.06)'
  },
  'moss-zen': {
    id: 'moss-zen',
    name: 'Moss Ground',
    baseColor: '#DFDDD0',
    grainDark: '#A2A590',
    grainLight: '#EFF0E6',
    grooveTrough: '#90957F',
    grooveShadow: 'rgba(45, 52, 38, 0.38)',
    grooveHighlight: 'rgba(255, 255, 250, 0.70)',
    ambientLight: 'rgba(245, 250, 240, 0.08)'
  }
};
