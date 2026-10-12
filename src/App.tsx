import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { RakeEngine } from './engine/RakeEngine';
import { GardenRenderer } from './engine/render/GardenRenderer';
import { HandTracker } from './engine/mediapipe/HandTracker';
import { AirRakeAdapter } from './engine/input/AirRakeAdapter';
import { ZenAudioEngine } from './engine/audio/ZenAudioEngine';
import {
  GardenCanvas
} from './components/Canvas/GardenCanvas';
import { TopBar } from './components/TopBar/TopBar';
import { MainToolbar } from './components/Toolbar/MainToolbar';
import { ContextualControls } from './components/Toolbar/ContextualControls';
import { AirRakeCursor } from './components/AirRake/AirRakeCursor';
import { AirRakePreview } from './components/AirRake/AirRakePreview';
import { AirRakeModal } from './components/AirRake/AirRakeModal';
import { BreathingOverlay } from './components/Breathing/BreathingOverlay';
import { MindfulMessage } from './components/Messages/MindfulMessage';
import { SettingsModal } from './components/Settings/SettingsModal';
import {
  ToolType,
  RakeConfig,
  GardenSettings,
  AirRakeSettings,
  TrackingStatus,
  SandPaletteId
} from './types/garden';
import {
  loadGardenState,
  saveGardenStateDebounced,
  loadAirRakeSettings,
  saveAirRakeSettings,
  DEFAULT_AIR_RAKE_SETTINGS,
  DEFAULT_GARDEN_STATE
} from './engine/persistence/database';
import { GardenPreset, GARDEN_PRESETS } from './engine/persistence/presets';

export const App: React.FC = () => {
  // --- Persistent Engine Instances ---
  const audioEngine = useMemo(() => new ZenAudioEngine(), []);
  const renderer = useMemo(() => new GardenRenderer(), []);
  
  // Rake Engine with reactivity callbacks
  const [tick, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const engine = useMemo(() => {
    return new RakeEngine({
      onStateChange: () => rerender(),
      onRakingActivity: (active, speed) => {
        audioEngine.setRaking(active, speed);
      }
    });
  }, [audioEngine, rerender]);

  // Settings State
  const [gardenSettings, setGardenSettings] = useState<GardenSettings>(DEFAULT_GARDEN_STATE.settings);
  const [airRakeSettings, setAirRakeSettings] = useState<AirRakeSettings>(DEFAULT_AIR_RAKE_SETTINGS);

  // Modals & Panels State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAirRakeOpen, setIsAirRakeOpen] = useState(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);

  // Air Rake Tracking State
  const [airRakeStatus, setAirRakeStatus] = useState<TrackingStatus>('idle');
  const [airRakeError, setAirRakeError] = useState<string | undefined>();
  const [handPresent, setHandPresent] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pinchDistance, setPinchDistance] = useState(1.0);

  // Tracker and Adapter Refs
  const trackerRef = useRef<HandTracker | null>(null);
  const adapterRef = useRef<AirRakeAdapter | null>(null);

  // Tool & Config State
  const [currentTool, setCurrentTool] = useState<ToolType>('rake');
  const [rakeConfig, setRakeConfig] = useState<RakeConfig>(engine.getRakeConfig());

  // 1. Initial Load of Garden State & Presets from Persistence
  useEffect(() => {
    loadGardenState().then((saved) => {
      engine.setGardenState(saved.elements, saved.stones);
      setGardenSettings(saved.settings);
      if (saved.settings.soundscape !== 'none') {
        audioEngine.setSoundscape(saved.settings.soundscape);
        audioEngine.setVolume(saved.settings.soundVolume);
      }
    });

    loadAirRakeSettings().then((savedAir) => {
      setAirRakeSettings(savedAir);
    });
  }, [engine, audioEngine]);

  // 2. Initialize HandTracker
  useEffect(() => {
    const tracker = new HandTracker(airRakeSettings);
    trackerRef.current = tracker;

    const adapter = new AirRakeAdapter(engine, tracker);
    adapterRef.current = adapter;

    const unsubsStatus = tracker.onStatus((status, err) => {
      setAirRakeStatus(status);
      setAirRakeError(err);
    });

    const unsubsState = tracker.onState((state) => {
      setHandPresent(state.handPresent);
      setIsPinching(state.isPinching);
      setCursorPos(state.cursorPos);
      setPinchDistance(state.pinchDistance);
    });

    return () => {
      unsubsStatus();
      unsubsState();
      adapter.detach();
      tracker.stop();
    };
  }, [engine]);

  // 3. Sync Settings changes to HandTracker
  useEffect(() => {
    trackerRef.current?.updateSettings(airRakeSettings);
    saveAirRakeSettings(airRakeSettings);
  }, [airRakeSettings]);

  // 4. Autosave Garden State on geometry change
  useEffect(() => {
    const state = {
      version: 1,
      elements: engine.getElements(),
      stones: engine.getStones(),
      settings: gardenSettings
    };
    saveGardenStateDebounced(state);
  }, [engine, gardenSettings, tick]);

  // --- Air Rake Handlers ---

  const handleToggleAirRake = useCallback(
    async (enable: boolean) => {
      const tracker = trackerRef.current;
      const adapter = adapterRef.current;
      if (!tracker || !adapter) return;

      if (enable) {
        setAirRakeSettings((prev) => ({ ...prev, enabled: true }));
        adapter.attach();
        const ok = await tracker.start();
        if (!ok) {
          setAirRakeSettings((prev) => ({ ...prev, enabled: false }));
          adapter.detach();
        }
      } else {
        setAirRakeSettings((prev) => ({ ...prev, enabled: false }));
        adapter.detach();
        tracker.stop();
      }
    },
    []
  );

  const handleUpdateAirRakeSettings = (patch: Partial<AirRakeSettings>) => {
    setAirRakeSettings((prev) => ({ ...prev, ...patch }));
  };

  // --- Tool & Rake Handlers ---

  const handleSelectTool = (tool: ToolType) => {
    setCurrentTool(tool);
    engine.setTool(tool);
  };

  const handleUpdateRakeConfig = (patch: Partial<RakeConfig>) => {
    const next = { ...rakeConfig, ...patch };
    setRakeConfig(next);
    engine.setRakeConfig(next);
  };

  // --- Presets & Export Handlers ---

  const handleSelectPreset = (preset: GardenPreset) => {
    engine.setGardenState(preset.elements, preset.stones);
    setGardenSettings((prev) => ({ ...prev, paletteId: preset.paletteId }));
  };

  const handleExportPNG = () => {
    const dataUrl = renderer.exportGardenPNG(
      window.innerWidth,
      window.innerHeight,
      gardenSettings.paletteId,
      engine.getElements(),
      engine.getStones(),
      2
    );
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `little-zen-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleResetGarden = () => {
    engine.clearGarden();
  };

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.undo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.redo();
        return;
      }

      // Escape: Close modals or cancel current action
      if (e.key === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isAirRakeOpen) setIsAirRakeOpen(false);
        if (isBreathingOpen) setIsBreathingOpen(false);
        engine.setSelectedStoneId(null);
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'r':
          handleSelectTool('rake');
          break;
        case 'c':
          handleSelectTool('circle');
          break;
        case 'l':
          handleSelectTool('line');
          break;
        case 'w':
          handleSelectTool('wave');
          break;
        case 'p':
          handleSelectTool('spiral');
          break;
        case 's':
          handleSelectTool('stone');
          break;
        case 'e':
          handleSelectTool('smooth');
          break;
        case 'f':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, isSettingsOpen, isAirRakeOpen, isBreathingOpen]);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#F3EDE2]">
      {/* 1. Main Interactive Zen Garden Canvas */}
      <GardenCanvas
        engine={engine}
        renderer={renderer}
        paletteId={gardenSettings.paletteId}
      />

      {/* 2. Air Rake Virtual Fingertip Cursor Overlay */}
      {airRakeSettings.enabled && (
        <AirRakeCursor
          cursorPos={cursorPos}
          isPinching={isPinching}
          handPresent={handPresent}
        />
      )}

      {/* 3. Subtle Camera Preview Window for Air Rake */}
      {airRakeSettings.enabled && airRakeSettings.previewVisible && trackerRef.current && (
        <AirRakePreview
          tracker={trackerRef.current}
          settings={airRakeSettings}
          status={airRakeStatus}
          handPresent={handPresent}
          onClose={() => handleUpdateAirRakeSettings({ previewVisible: false })}
        />
      )}

      {/* 4. Top Understated Bar */}
      <TopBar
        currentTool={currentTool}
        airRakeEnabled={airRakeSettings.enabled}
        airRakeStatus={airRakeStatus}
        handPresent={handPresent}
        onOpenAirRake={() => setIsAirRakeOpen(true)}
        onOpenBreathing={() => setIsBreathingOpen(true)}
        soundscape={gardenSettings.soundscape}
        soundVolume={gardenSettings.soundVolume}
        onSoundscapeChange={(type) => setGardenSettings((prev) => ({ ...prev, soundscape: type }))}
        onVolumeChange={(vol) => setGardenSettings((prev) => ({ ...prev, soundVolume: vol }))}
        audioEngine={audioEngine}
      />

      {/* 5. Mindful Reflection Message */}
      <MindfulMessage enabled={gardenSettings.messagesEnabled} />

      {/* 6. Contextual Controls (floats above toolbar) */}
      <ContextualControls
        currentTool={currentTool}
        rakeConfig={rakeConfig}
        onUpdateRakeConfig={handleUpdateRakeConfig}
        engine={engine}
        selectedStoneId={engine.getSelectedStoneId()}
        onClearGardenRequest={handleResetGarden}
      />

      {/* 7. Bottom Main Floating Toolbar */}
      <MainToolbar
        currentTool={currentTool}
        onSelectTool={handleSelectTool}
        canUndo={engine.canUndo()}
        canRedo={engine.canRedo()}
        onUndo={() => engine.undo()}
        onRedo={() => engine.redo()}
        airRakeEnabled={airRakeSettings.enabled}
        onToggleAirRake={() => setIsAirRakeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 8. Air Rake Configuration & Calibration Modal */}
      <AirRakeModal
        isOpen={isAirRakeOpen}
        onClose={() => setIsAirRakeOpen(false)}
        settings={airRakeSettings}
        onUpdateSettings={handleUpdateAirRakeSettings}
        status={airRakeStatus}
        errorMessage={airRakeError}
        onToggleAirRake={handleToggleAirRake}
        currentPinchDistance={pinchDistance}
        isCurrentlyPinching={isPinching}
      />

      {/* 9. Breathing Relaxation Overlay ("Just breathe") */}
      <BreathingOverlay
        isOpen={isBreathingOpen}
        onClose={() => setIsBreathingOpen(false)}
        reducedMotion={gardenSettings.reducedMotion}
      />

      {/* 10. Garden Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={gardenSettings}
        onUpdateSettings={(patch) => setGardenSettings((prev) => ({ ...prev, ...patch }))}
        onSelectPreset={handleSelectPreset}
        onExportPNG={handleExportPNG}
        onResetGarden={handleResetGarden}
        audioEngine={audioEngine}
      />
    </div>
  );
};

export default App;
