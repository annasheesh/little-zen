import React from 'react';
import {
  ToolType,
  RakeConfig,
  StoneType,
  RakePresetType
} from '../../types/garden';
import { RakeEngine } from '../../engine/RakeEngine';
import { RotateCw, Trash2, Plus, Minus, Maximize2, RefreshCw } from 'lucide-react';

interface ContextualControlsProps {
  currentTool: ToolType;
  rakeConfig: RakeConfig;
  onUpdateRakeConfig: (config: Partial<RakeConfig>) => void;
  engine: RakeEngine;
  selectedStoneId: string | null;
  onClearGardenRequest: () => void;
}

export const ContextualControls: React.FC<ContextualControlsProps> = ({
  currentTool,
  rakeConfig,
  onUpdateRakeConfig,
  engine,
  selectedStoneId,
  onClearGardenRequest
}) => {
  // Preset selector for free rake
  const selectPreset = (preset: RakePresetType) => {
    switch (preset) {
      case 'fine':
        onUpdateRakeConfig({
          preset: 'fine',
          prongCount: 5,
          prongSpacing: 0.008,
          grooveWidth: 0.0035,
          depth: 0.85
        });
        break;
      case 'classic':
        onUpdateRakeConfig({
          preset: 'classic',
          prongCount: 3,
          prongSpacing: 0.012,
          grooveWidth: 0.006,
          depth: 1.0
        });
        break;
      case 'wide':
        onUpdateRakeConfig({
          preset: 'wide',
          prongCount: 3,
          prongSpacing: 0.02,
          grooveWidth: 0.009,
          depth: 1.2
        });
        break;
    }
  };

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="zen-glass rounded-xl px-4 py-2 flex items-center gap-4 text-xs text-[#34332F] shadow-lg border border-[rgba(200,184,157,0.4)]">
        {/* Rake Controls */}
        {currentTool === 'rake' && (
          <>
            <div className="flex items-center gap-1 border-r border-[#C8B89D]/40 pr-3">
              {(['fine', 'classic', 'wide'] as RakePresetType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => selectPreset(p)}
                  className={`px-2 py-1 rounded capitalize font-medium cursor-pointer transition-colors ${
                    rakeConfig.preset === p
                      ? 'bg-[#34332F] text-[#F8F3E9]'
                      : 'text-[#777269] hover:bg-black/5'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#777269]">Prongs:</span>
              <div className="flex items-center gap-1">
                {[1, 3, 5, 7].map((num) => (
                  <button
                    key={num}
                    onClick={() => onUpdateRakeConfig({ prongCount: num, preset: 'custom' })}
                    className={`w-6 h-6 rounded flex items-center justify-center font-medium cursor-pointer ${
                      rakeConfig.prongCount === num
                        ? 'bg-[#34332F] text-[#F8F3E9]'
                        : 'text-[#777269] hover:bg-black/5'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-[#C8B89D]/40">
              <span className="text-[#777269]">Depth:</span>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={rakeConfig.depth}
                onChange={(e) =>
                  onUpdateRakeConfig({ depth: parseFloat(e.target.value), preset: 'custom' })
                }
                className="w-16"
              />
            </div>
          </>
        )}

        {/* Circle Controls */}
        {currentTool === 'circle' && (
          <div className="flex items-center gap-4">
            <span className="text-[#777269]">Click & drag center to expand concentric rings</span>
            <div className="flex items-center gap-2 border-l border-[#C8B89D]/40 pl-3">
              <span className="text-[#777269]">Groove Depth:</span>
              <input
                type="range"
                min="0.5"
                max="1.4"
                step="0.1"
                value={rakeConfig.depth}
                onChange={(e) => onUpdateRakeConfig({ depth: parseFloat(e.target.value) })}
                className="w-20"
              />
            </div>
          </div>
        )}

        {/* Line Controls */}
        {currentTool === 'line' && (
          <div className="flex items-center gap-4">
            <span className="text-[#777269]">Drag to draw parallel straight comb lines</span>
            <div className="flex items-center gap-2 border-l border-[#C8B89D]/40 pl-3">
              <span className="text-[#777269]">Line Depth:</span>
              <input
                type="range"
                min="0.5"
                max="1.4"
                step="0.1"
                value={rakeConfig.depth}
                onChange={(e) => onUpdateRakeConfig({ depth: parseFloat(e.target.value) })}
                className="w-20"
              />
            </div>
          </div>
        )}

        {/* Wave Controls */}
        {currentTool === 'wave' && (
          <div className="flex items-center gap-4">
            <span className="text-[#777269]">Drag start to end to generate rhythmic waves</span>
            <div className="flex items-center gap-2 border-l border-[#C8B89D]/40 pl-3">
              <span className="text-[#777269]">Wave Depth:</span>
              <input
                type="range"
                min="0.5"
                max="1.4"
                step="0.1"
                value={rakeConfig.depth}
                onChange={(e) => onUpdateRakeConfig({ depth: parseFloat(e.target.value) })}
                className="w-20"
              />
            </div>
          </div>
        )}

        {/* Spiral Controls */}
        {currentTool === 'spiral' && (
          <div className="flex items-center gap-4">
            <span className="text-[#777269]">Drag outward from center to create tranquil spiral</span>
          </div>
        )}

        {/* Stone Controls */}
        {currentTool === 'stone' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[#777269] mr-1">Add:</span>
              {(['dark-river', 'slate', 'granite', 'weathered', 'pebble'] as StoneType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => engine.addStone(type)}
                    className="px-2 py-1 rounded bg-black/5 hover:bg-black/10 text-[11px] capitalize cursor-pointer transition-colors"
                  >
                    {type.replace('-', ' ')}
                  </button>
                )
              )}
            </div>

            {selectedStoneId && (
              <div className="flex items-center gap-1.5 border-l border-[#C8B89D]/40 pl-3">
                <button
                  onClick={() => engine.rotateSelectedStone(Math.PI / 12)}
                  className="p-1 hover:bg-black/5 rounded text-[#777269] hover:text-[#34332F] cursor-pointer"
                  title="Rotate stone"
                >
                  <RotateCw size={13} />
                </button>
                <button
                  onClick={() => engine.resizeSelectedStone(1.1)}
                  className="p-1 hover:bg-black/5 rounded text-[#777269] hover:text-[#34332F] cursor-pointer"
                  title="Scale up"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => engine.resizeSelectedStone(0.9)}
                  className="p-1 hover:bg-black/5 rounded text-[#777269] hover:text-[#34332F] cursor-pointer"
                  title="Scale down"
                >
                  <Minus size={13} />
                </button>
                <button
                  onClick={() => engine.removeSelectedStone()}
                  className="p-1 hover:bg-rose-50 rounded text-rose-700 cursor-pointer"
                  title="Remove stone"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Smooth / Erase Controls */}
        {currentTool === 'smooth' && (
          <div className="flex items-center gap-4">
            <span className="text-[#777269]">Drag to locally smooth sand grooves</span>
            <button
              onClick={onClearGardenRequest}
              className="px-2.5 py-1 rounded bg-rose-800 text-white hover:bg-rose-900 transition-colors cursor-pointer text-xs font-medium ml-2"
            >
              Rake All Clean
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
