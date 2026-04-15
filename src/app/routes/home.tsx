import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Camera, Check, Copy, Keyboard, Loader2, ScanText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import env from "@/config/env";

export function HomePage() {
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startScreenshot = useCallback(async () => {
    const appWindow = getCurrentWindow();
    try {
      await appWindow.hide();
      await new Promise((r) => setTimeout(r, 200));
      const dataUri = await invoke<string>("screenshot_region");
      await appWindow.show();
      await appWindow.setFocus();

      setScreenshotSrc(dataUri);
      setOcrResult(null);
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(env.GLM_OCR_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "glm-ocr",
            file: dataUri,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setOcrResult(data.md_results ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "OCR 调用失败");
      } finally {
        setIsLoading(false);
      }
    } catch {
      await appWindow.show();
    }
  }, []);

  useEffect(() => {
    const unlisten = listen("screenshot-shortcut", () => {
      startScreenshot();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [startScreenshot]);

  const handleCopy = useCallback(async () => {
    if (!ocrResult) {
      return;
    }
    await navigator.clipboard.writeText(ocrResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [ocrResult]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-border/50 border-b px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
            <ScanText className="size-5 text-primary-foreground" />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Screen OCR</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-muted-foreground text-xs">
            <Keyboard className="size-3.5" />
            <kbd className="font-mono">⌘</kbd>
            <kbd className="font-mono">⇧</kbd>
            <kbd className="font-mono">A</kbd>
          </div>
          <Button className="rounded-lg" onClick={startScreenshot} size="sm">
            <Camera className="size-4" />
            Capture
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1">
        {screenshotSrc || isLoading ? (
          /* Two Column Layout */
          <div className="flex flex-1 divide-x divide-border/50">
            {/* Left: Screenshot */}
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="flex shrink-0 items-center justify-between border-border/50 border-b px-6 py-3">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Screenshot
                </span>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
                {screenshotSrc ? (
                  <img
                    alt="Captured region"
                    className="max-h-full max-w-full rounded-2xl border border-border/50 shadow-black/5 shadow-lg"
                    src={screenshotSrc}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Waiting for capture...
                  </div>
                )}
              </div>
            </div>

            {/* Right: OCR Result */}
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="flex shrink-0 items-center justify-between border-border/50 border-b px-6 py-3">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  OCR Result
                </span>
                {ocrResult && (
                  <Button
                    className="h-7 gap-1.5 rounded-lg px-2 text-xs"
                    onClick={handleCopy}
                    size="sm"
                    variant="ghost"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-6">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="size-10 rounded-full border-2 border-muted" />
                        <div className="absolute inset-0 size-10 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Recognizing text...
                      </p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
                        <span className="text-lg">⚠</span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          Recognition failed
                        </p>
                        <p className="max-w-xs text-muted-foreground text-xs">
                          {error}
                        </p>
                      </div>
                      <Button
                        className="rounded-lg"
                        onClick={startScreenshot}
                        size="sm"
                        variant="outline"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : ocrResult ? (
                  <pre className="whitespace-pre-wrap break-words rounded-2xl bg-muted/50 p-5 font-mono text-sm leading-relaxed">
                    {ocrResult}
                  </pre>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground text-sm">
                      No result yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
                <Camera className="size-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="font-medium text-xl tracking-tight">
                  Capture a region to start
                </h2>
                <p className="max-w-sm text-muted-foreground text-sm">
                  Click the capture button or press
                  <kbd className="mx-1 inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    ⌘⇧A
                  </kbd>
                  to select a screen region for OCR recognition.
                </p>
              </div>
              <Button className="rounded-xl px-6" onClick={startScreenshot}>
                <Camera className="size-4" />
                Start Capture
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export const Component = HomePage;
