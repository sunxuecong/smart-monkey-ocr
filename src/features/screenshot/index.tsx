import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function ScreenshotOverlay() {
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    invoke<string>("get_screenshot")
      .then((dataUri) => {
        setScreenshotSrc(dataUri);
      })
      .catch((err: unknown) => {
        console.error("get_screenshot failed:", err);
        window.close();
      });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        emit("screenshot-captured", { data: null });
        window.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!screenshotSrc) {
        return;
      }
      setIsSelecting(true);
      setSelection({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      });
    },
    [screenshotSrc]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting) {
        return;
      }
      setSelection((prev) => {
        if (!prev) {
          return null;
        }
        return { ...prev, endX: e.clientX, endY: e.clientY };
      });
    },
    [isSelecting]
  );

  const handleMouseUp = useCallback(async () => {
    if (!(selection && isSelecting)) {
      return;
    }
    setIsSelecting(false);

    const img = imageRef.current;
    if (!img) {
      return;
    }

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const convertX = (clientX: number) => {
      const rect = img.getBoundingClientRect();
      return (clientX - rect.left) * (naturalWidth / displayWidth);
    };
    const convertY = (clientY: number) => {
      const rect = img.getBoundingClientRect();
      return (clientY - rect.top) * (naturalHeight / displayHeight);
    };

    const minX = Math.min(selection.startX, selection.endX);
    const minY = Math.min(selection.startY, selection.endY);
    const maxX = Math.max(selection.startX, selection.endX);
    const maxY = Math.max(selection.startY, selection.endY);

    const x = Math.round(convertX(minX));
    const y = Math.round(convertY(minY));
    const width = Math.round(convertX(maxX) - x);
    const height = Math.round(convertY(maxY) - y);

    if (width < 5 || height < 5) {
      setSelection(null);
      return;
    }

    try {
      const dataUri = await invoke<string>("crop_image", {
        x,
        y,
        width,
        height,
      });
      await emit("screenshot-captured", { data: dataUri });
    } catch (err) {
      console.error("crop_image failed:", err);
      await emit("screenshot-captured", { data: null });
    }
    window.close();
  }, [selection, isSelecting]);

  if (!screenshotSrc) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <p className="text-lg text-white">Capturing screen...</p>
      </div>
    );
  }

  const minX = selection ? Math.min(selection.startX, selection.endX) : 0;
  const minY = selection ? Math.min(selection.startY, selection.endY) : 0;
  const maxX = selection ? Math.max(selection.startX, selection.endX) : 0;
  const maxY = selection ? Math.max(selection.startY, selection.endY) : 0;

  return (
    <div
      className="fixed inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      role="application"
      tabIndex={0}
    >
      <img
        ref={imageRef}
        src={screenshotSrc}
        alt="screenshot"
        width={window.screen.width}
        height={window.screen.height}
        className="h-full w-full select-none object-fill"
        draggable={false}
      />

      {selection && (
        <>
          <div
            className="pointer-events-none fixed bg-black/50"
            style={{
              left: 0,
              top: 0,
              right: 0,
              bottom: `calc(100% - ${minY}px)`,
            }}
          />
          <div
            className="pointer-events-none fixed bg-black/50"
            style={{ left: 0, top: `${maxY}px`, right: 0, bottom: 0 }}
          />
          <div
            className="pointer-events-none fixed bg-black/50"
            style={{
              left: 0,
              top: `${minY}px`,
              right: `calc(100% - ${minX}px)`,
              bottom: `calc(100% - ${maxY}px)`,
            }}
          />
          <div
            className="pointer-events-none fixed bg-black/50"
            style={{
              left: `${maxX}px`,
              top: `${minY}px`,
              right: 0,
              bottom: `calc(100% - ${maxY}px)`,
            }}
          />
          <div
            className="pointer-events-none fixed border-2 border-blue-500"
            style={{
              left: `${minX}px`,
              top: `${minY}px`,
              width: `${maxX - minX}px`,
              height: `${maxY - minY}px`,
            }}
          />
        </>
      )}
    </div>
  );
}
