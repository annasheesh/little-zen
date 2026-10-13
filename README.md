# Little Zen (リトル禅)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/annasheesh/little-zen)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)

> *"When your mind gets messy, rake the sand."*

A beautiful, minimalist Japanese karesansui-inspired desktop Zen garden application. Users can rake fine virtual sand, arrange natural stones, generate geometric and wave patterns, relax with ambient soundscapes and guided breathing, or control the sand entirely touch-free through webcam hand tracking (**Air Rake**).

---

## Key Features

1. **Realistic Procedural Sand Engine (HTML Canvas 2D)**:
   - High-DPI responsive canvas rendering with fine sand micro-grain textures.
   - Recessed 3D grooves with multi-pass directional shading (trough, soft contact shadow, fine crest highlight).
   - Natural splines with Cardinal curve smoothing for organic rake curves.

2. **Three Input Modes (Unified Shared Architecture)**:
   - **Mouse & Trackpad**: Traditional click-and-drag sand raking.
   - **Air Rake (Webcam Hand Tracking)**: Real-time hand landmark tracking powered by Google's `@mediapipe/tasks-vision`.
     - *Point & Hover*: Move index fingertip to guide the virtual cursor without drawing.
     - *Pinch*: Pinch thumb and index fingertip together to start carving sand.
     - *Release*: Open fingers to end the stroke and pause.
     - Low-latency **One Euro Filter** for jitter-free cursor tracking with dynamic velocity adaptation.
     - Scale-invariant pinch metric with temporal hysteresis to eliminate flickers.
     - Privacy-first: 100% on-device processing; no frames or images are recorded or uploaded.
   - **Touchscreen**: Multi-touch and pen support with active stroke priority arbitration.

3. **Pattern & Gardening Tools**:
   - **Free Rake**: Fine, classic, and wide presets with customizable prongs (1 to 7 tines), spacing, and groove depth.
   - **Concentric Rings**: Drag outward to create concentric water ripples around grounding stones.
   - **Straight Lines**: Clean parallel comb patterns.
   - **Harmonic Waves**: Rhythmic sine waves with configurable amplitude and frequency.
   - **Spirals**: Expanding Archimedean spirals.
   - **Procedural Stones**: Dark river stones, charcoal slate, warm granite, weathered stones, and pebbles with realistic 3D contact shadows, ambient occlusion, highlights, and moss accents. Move, rotate, scale, or remove stones.
   - **Smooth & Erase**: Locally smooth sand back to untouched flat surface, or clear the whole garden with confirmation.

4. **Mindfulness & Atmosphere**:
   - **"Just Breathe" Mode**: Subtle 4-second inhale, 6-second exhale expanding/contracting circle with 2, 5, 10-minute and continuous sessions.
   - **Ambient Soundscapes**: Web Audio API procedural synthesizers for Gentle Rain, Soft Wind, Distant Birds, Quiet Water, and tactile sand raking friction audio. Zero external audio file dependencies.
   - **Gentle Mindful Reflections**: Sparing reflections in refined serif typography.

5. **5 Japanese Garden Presets**:
   - *Morning Stillness* (Default scene: ivory sand, ripples around river stones).
   - *Rain on Stone* (Cool slate sand, dual concentric ripple echoes).
   - *Quiet Moon* (Pale sand, expansive orbital spiral around solitary stone).
   - *Warm Sand* (Natural dune sand with deep parallel ocean waves).
   - *Empty Garden* (Pristine untouched sand with balanced stones).

6. **Persistence & Export**:
   - IndexedDB and localStorage autosave with debouncing.
   - 40-step Undo / Redo history.
   - High-resolution standalone PNG export without UI elements.
   - 100% Offline-capable: MediaPipe WASM and `hand_landmarker.task` model (7.8MB) bundled locally in `public/mediapipe/`.

---

## Getting Started

### Prerequisites
- Node.js (v18+ or v24 LTS)
- npm

### Installation
```bash
npm install
```

### Running in Development (Web)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Desktop App (Electron)
```bash
npm run electron:dev
```
Or build the web assets first and run:
```bash
npm run build
npm run electron
```

### Building the Standalone Desktop Application
```bash
npm run electron:build
```
This generates the packaged installer for your operating system in `dist/`.

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `R` | Free Rake tool |
| `C` | Concentric Rings tool |
| `L` | Straight Lines tool |
| `W` | Harmonic Wave tool |
| `P` | Spiral tool |
| `S` | Stone placement & manipulation |
| `E` | Smooth / Erase sand |
| `Ctrl + Z` / `Cmd + Z` | Undo last stroke or action |
| `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo action |
| `Escape` | Dismiss modal or deselect stone |
| `F` | Toggle fullscreen |

---

## Air Rake Instructions

1. Click the **Air Rake** button on the bottom toolbar or the camera status pill on the top right.
2. In the modal, click **Enable Air Rake** and grant camera permissions when prompted.
3. Position your hand so it is clearly visible to your webcam:
   - **Point** with your index finger to hover the virtual cursor over the sand.
   - **Pinch** your thumb and index fingertip together to begin carving grooves.
   - Move your pinched hand across the space to rake.
   - **Release** the pinch to complete the stroke and pause.
4. Customize sensitivity, cursor smoothing, and pinch trigger threshold in the Air Rake settings modal anytime.

---

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check out the [Contributing Guide](CONTRIBUTING.md) and open an issue or pull request.

---

## License

This project is open source and available under the [MIT License](LICENSE).

