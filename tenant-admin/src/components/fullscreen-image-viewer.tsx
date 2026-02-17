"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

/** Converts base64 (with or without data URL prefix) to a data URL for img src. */
export function toDataUrl(base64: string): string {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  return raw ? `data:image/jpeg;base64,${raw}` : "";
}

type Props = {
  imageDataUrl: string;
  title?: string;
  onClose: () => void;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const STEP = 0.25;

export function FullscreenImageViewer({ imageDataUrl, title, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + STEP));
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s - STEP));
  }, []);
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setScale((s) => Math.min(MAX_SCALE, s + STEP));
      else if (e.deltaY > 0) setScale((s) => Math.max(MIN_SCALE, s - STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-900/80 shrink-0">
        <span className="text-sm font-medium text-white truncate max-w-[60%]">
          {title ?? "Image"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 hidden sm:inline">Scroll to zoom</span>
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-xs text-zinc-400 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area - scrollable/pannable, wheel zoom */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <img
          src={imageDataUrl}
          alt={title ?? "Full screen"}
          className="max-w-none select-none pointer-events-none shadow-2xl"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

