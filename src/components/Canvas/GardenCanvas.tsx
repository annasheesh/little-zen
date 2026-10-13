import React, { useEffect, useRef, useCallback } from 'react';
import { RakeEngine } from '../../engine/RakeEngine';
import { GardenRenderer } from '../../engine/render/GardenRenderer';
import { MouseTouchAdapter } from '../../engine/input/MouseTouchAdapter';
import { SandPaletteId } from '../../types/garden';

interface GardenCanvasProps {
  engine: RakeEngine;
  renderer: GardenRenderer;
  paletteId: SandPaletteId;
}

export const GardenCanvas: React.FC<GardenCanvasProps> = ({
  engine,
  renderer,
  paletteId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MouseTouchAdapter | null>(null);

  // Render frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    renderer.render(
      ctx,
      width,
      height,
      dpr,
      paletteId,
      engine.getElements(),
      engine.getActiveElement(),
      engine.getStones(),
      engine.getSelectedStoneId(),
      engine.getHeightfield()
    );
  }, [engine, renderer, paletteId]);

  // Handle canvas resize while preserving garden geometry
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = Math.max(100, Math.floor(rect.width));
    const height = Math.max(100, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    engine.setAspectRatio(width / height);
    draw();
  }, [draw, engine]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Redraw when engine state changes
  useEffect(() => {
    draw();
  });

  // Attach mouse & touch pointer adapter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const adapter = new MouseTouchAdapter(engine);
    adapterRef.current = adapter;
    adapter.attach(canvas);

    return () => {
      adapter.detach();
      adapterRef.current = null;
    };
  }, [engine]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none cursor-crosshair"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
};
