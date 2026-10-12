export type ToolType = 
  | 'rake' 
  | 'circle' 
  | 'line' 
  | 'wave' 
  | 'spiral' 
  | 'stone' 
  | 'smooth';

export type RakePresetType = 'fine' | 'classic' | 'wide' | 'custom';

export interface RakeConfig {
  preset: RakePresetType;
  prongCount: number;      // 1 to 7 tines
  prongSpacing: number;    // distance between tines in normalized space (0.005 to 0.04)
  grooveWidth: number;     // width of each tine groove (0.003 to 0.02)
  depth: number;           // visual contrast/depth (0.4 to 1.5)
}

export type SandPaletteId = 'warm-ivory' | 'natural-sand' | 'pale-sand' | 'slate-sand' | 'moss-zen';

export interface SandPalette {
  id: SandPaletteId;
  name: string;
  baseColor: string;       // #F3EDE2
  grainDark: string;       // #C8B89D
  grainLight: string;      // #F8F3E9
  grooveTrough: string;    // #A8987E
  grooveShadow: string;    // rgba(50, 40, 25, 0.45)
  grooveHighlight: string; // rgba(255, 255, 255, 0.6)
  ambientLight: string;
}

export interface Point {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  time?: number;
}

export interface FreehandStroke {
  id: string;
  type: 'freehand';
  points: Point[];
  prongOffsets: number[];  // relative offsets for multi-tine rake [-2, -1, 0, 1, 2] * spacing
  grooveWidth: number;
  depth: number;
}

export interface CirclePattern {
  id: string;
  type: 'circle';
  centerX: number;
  centerY: number;
  innerRadius: number;
  ringCount: number;
  ringSpacing: number;
  grooveWidth: number;
  depth: number;
}

export interface LinePattern {
  id: string;
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lineCount: number;
  lineSpacing: number;
  grooveWidth: number;
  depth: number;
}

export interface WavePattern {
  id: string;
  type: 'wave';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  amplitude: number;
  frequency: number;
  lineCount: number;
  lineSpacing: number;
  grooveWidth: number;
  depth: number;
}

export interface SpiralPattern {
  id: string;
  type: 'spiral';
  centerX: number;
  centerY: number;
  radius: number;
  turns: number;
  grooveWidth: number;
  depth: number;
}

export interface SmoothStroke {
  id: string;
  type: 'smooth';
  points: Point[];
  radius: number;
}

export type GardenGrooveElement = 
  | FreehandStroke 
  | CirclePattern 
  | LinePattern 
  | WavePattern 
  | SpiralPattern 
  | SmoothStroke;

export type StoneType = 
  | 'dark-river' 
  | 'slate' 
  | 'granite' 
  | 'weathered' 
  | 'pebble' 
  | 'grounding';

export interface MossPatch {
  offsetX: number;
  offsetY: number;
  radius: number;
  opacity: number;
}

export interface GardenStone {
  id: string;
  type: StoneType;
  x: number;               // Normalized 0..1
  y: number;               // Normalized 0..1
  radiusX: number;         // Normalized size
  radiusY: number;         // Normalized size
  rotation: number;        // Radians
  seed: number;            // Random seed for procedural silhouette
  moss?: MossPatch[];
}

export type TrackingStatus = 
  | 'idle' 
  | 'initializing' 
  | 'tracking' 
  | 'hand-lost' 
  | 'denied' 
  | 'error';

export interface AirRakeSettings {
  enabled: boolean;
  cameraId: string;
  previewVisible: boolean;
  mirrored: boolean;
  cursorSensitivity: number; // 0.8 to 2.0
  cursorSmoothing: number;   // 0.2 to 0.95
  pinchThreshold: number;    // distance to activate pinch (normalized hand space ~0.055)
  pinchReleaseThreshold: number; // distance to release pinch (~0.085)
  showInstruction: boolean;
}

export type SoundscapeType = 'none' | 'rain' | 'wind' | 'birds' | 'water';

export interface GardenSettings {
  paletteId: SandPaletteId;
  reducedMotion: boolean;
  messagesEnabled: boolean;
  soundscape: SoundscapeType;
  soundVolume: number;
  rakeSound: boolean;
}

export interface GardenState {
  version: number;
  elements: GardenGrooveElement[];
  stones: GardenStone[];
  settings: GardenSettings;
}
