import { GardenGrooveElement, GardenStone, SandPaletteId } from '../../types/garden';

export interface GardenPreset {
  id: string;
  name: string;
  description: string;
  paletteId: SandPaletteId;
  stones: GardenStone[];
  elements: GardenGrooveElement[];
}

export const GARDEN_PRESETS: GardenPreset[] = [
  {
    id: 'morning-stillness',
    name: 'Morning Stillness',
    description: 'Fine ivory sand with soft ripples encircling grounding river stones.',
    paletteId: 'warm-ivory',
    stones: [
      {
        id: 'stone-main',
        type: 'dark-river',
        x: 0.38,
        y: 0.44,
        radiusX: 0.075,
        radiusY: 0.055,
        rotation: 0.35,
        seed: 48291,
        moss: [{ offsetX: 0.25, offsetY: 0.2, radius: 0.018, opacity: 0.7 }]
      },
      {
        id: 'stone-secondary',
        type: 'slate',
        x: 0.49,
        y: 0.52,
        radiusX: 0.045,
        radiusY: 0.035,
        rotation: -0.4,
        seed: 12938
      },
      {
        id: 'stone-pebble',
        type: 'pebble',
        x: 0.72,
        y: 0.35,
        radiusX: 0.025,
        radiusY: 0.02,
        rotation: 0.8,
        seed: 94812
      }
    ],
    elements: [
      // Concentric rings around main stone cluster
      {
        id: 'preset-circle-1',
        type: 'circle',
        centerX: 0.42,
        centerY: 0.47,
        innerRadius: 0.11,
        ringCount: 4,
        ringSpacing: 0.016,
        grooveWidth: 0.0055,
        depth: 0.95
      },
      // Gentle waves across the top
      {
        id: 'preset-wave-1',
        type: 'wave',
        startX: 0.08,
        startY: 0.16,
        endX: 0.92,
        endY: 0.16,
        amplitude: 0.018,
        frequency: 4,
        lineCount: 3,
        lineSpacing: 0.016,
        grooveWidth: 0.005,
        depth: 0.85
      }
    ]
  },
  {
    id: 'rain-on-stone',
    name: 'Rain on Stone',
    description: 'Cool slate sand with multiple rippling echoes around scattered granite.',
    paletteId: 'slate-sand',
    stones: [
      {
        id: 'stone-rain-1',
        type: 'granite',
        x: 0.3,
        y: 0.38,
        radiusX: 0.065,
        radiusY: 0.05,
        rotation: 0.1,
        seed: 5821
      },
      {
        id: 'stone-rain-2',
        type: 'weathered',
        x: 0.65,
        y: 0.6,
        radiusX: 0.06,
        radiusY: 0.045,
        rotation: -0.6,
        seed: 88123
      }
    ],
    elements: [
      {
        id: 'rain-rings-1',
        type: 'circle',
        centerX: 0.3,
        centerY: 0.38,
        innerRadius: 0.09,
        ringCount: 5,
        ringSpacing: 0.015,
        grooveWidth: 0.005,
        depth: 0.9
      },
      {
        id: 'rain-rings-2',
        type: 'circle',
        centerX: 0.65,
        centerY: 0.6,
        innerRadius: 0.085,
        ringCount: 4,
        ringSpacing: 0.015,
        grooveWidth: 0.005,
        depth: 0.9
      }
    ]
  },
  {
    id: 'quiet-moon',
    name: 'Quiet Moon',
    description: 'Pale sand with a tranquil spiral expanding from a solitary charcoal stone.',
    paletteId: 'pale-sand',
    stones: [
      {
        id: 'stone-moon',
        type: 'grounding',
        x: 0.5,
        y: 0.5,
        radiusX: 0.08,
        radiusY: 0.06,
        rotation: 0,
        seed: 39182
      }
    ],
    elements: [
      {
        id: 'moon-spiral',
        type: 'spiral',
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.38,
        turns: 4.5,
        grooveWidth: 0.006,
        depth: 1.05
      }
    ]
  },
  {
    id: 'warm-sand',
    name: 'Warm Sand',
    description: 'Natural dune sand with deep parallel ocean waves.',
    paletteId: 'natural-sand',
    stones: [
      {
        id: 'stone-warm-1',
        type: 'dark-river',
        x: 0.28,
        y: 0.68,
        radiusX: 0.07,
        radiusY: 0.048,
        rotation: 0.5,
        seed: 77123
      },
      {
        id: 'stone-warm-2',
        type: 'pebble',
        x: 0.37,
        y: 0.73,
        radiusX: 0.028,
        radiusY: 0.02,
        rotation: -0.2,
        seed: 44102
      }
    ],
    elements: [
      {
        id: 'warm-wave-1',
        type: 'wave',
        startX: 0.06,
        startY: 0.25,
        endX: 0.94,
        endY: 0.25,
        amplitude: 0.03,
        frequency: 3,
        lineCount: 4,
        lineSpacing: 0.018,
        grooveWidth: 0.0065,
        depth: 1.0
      },
      {
        id: 'warm-wave-2',
        type: 'wave',
        startX: 0.06,
        startY: 0.45,
        endX: 0.94,
        endY: 0.45,
        amplitude: 0.03,
        frequency: 3,
        lineCount: 4,
        lineSpacing: 0.018,
        grooveWidth: 0.0065,
        depth: 1.0
      }
    ]
  },
  {
    id: 'empty-garden',
    name: 'Empty Garden',
    description: 'Untouched, pure combed ivory sand with three balanced stones.',
    paletteId: 'warm-ivory',
    stones: [
      {
        id: 'empty-stone-1',
        type: 'dark-river',
        x: 0.35,
        y: 0.45,
        radiusX: 0.07,
        radiusY: 0.05,
        rotation: 0.2,
        seed: 11111
      },
      {
        id: 'empty-stone-2',
        type: 'slate',
        x: 0.62,
        y: 0.55,
        radiusX: 0.055,
        radiusY: 0.04,
        rotation: -0.5,
        seed: 22222
      },
      {
        id: 'empty-stone-3',
        type: 'pebble',
        x: 0.25,
        y: 0.4,
        radiusX: 0.022,
        radiusY: 0.018,
        rotation: 0.7,
        seed: 33333
      }
    ],
    elements: []
  }
];
