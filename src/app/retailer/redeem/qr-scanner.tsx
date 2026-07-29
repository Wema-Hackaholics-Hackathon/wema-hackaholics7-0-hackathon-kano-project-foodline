"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button, cn } from "@/components/ui";

type ScanState = "requesting" | "denied" | "nocamera" | "active" | "decoded";

/**
 * A QR payload can be the full deep link (https://foodline.../r/<token>) or
 * the raw token itself. Either way, the last path segment is what we submit.
 */
function extractToken(data: string): string {
  const text = data.trim();
  try {
    const url = new URL(text);
    const segment = url.pathname.split("/").filter(Boolean).pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    // Not a URL, fall through to plain handling.
  }
  const segment = text.split("/").filter(Boolean).pop();
  return segment ?? text;
}

/**
 * Camera viewfinder that samples frames at ~10fps through an offscreen canvas
 * and runs jsQR over the pixels. Stops the stream the moment a code decodes.
 */
export function QrScanner({
  onDecode,
  onSwitchToCode,
}: {
  onDecode: (token: string) => void;
  onSwitchToCode: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>("requesting");

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let flashTimeout: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;
    let decoded = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("nocamera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setState(name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "denied");
        return;
      }
      if (cancelled) {
        stopStream();
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stopStream();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay interrupted (e.g. quick unmount); cleanup handles the rest.
      }
      if (cancelled) return;
      setState("active");

      interval = setInterval(() => {
        if (decoded || !ctx) return;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        if (!vw || !vh) return;
        // Downscale wide frames so jsQR stays fast on low-end phones.
        const scale = Math.min(1, 640 / vw);
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        });
        if (result?.data) {
          decoded = true;
          setState("decoded");
          if (interval) clearInterval(interval);
          stopStream();
          const token = extractToken(result.data);
          // Let the good-tint flash land before the flow moves on.
          flashTimeout = setTimeout(() => {
            if (!cancelled) onDecode(token);
          }, 350);
        }
      }, 100);
    };

    void start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (flashTimeout) clearTimeout(flashTimeout);
      stopStream();
    };
    // onDecode/onSwitchToCode are stable callbacks from the flow component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanning = state === "active";
  const done = state === "decoded";

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-espresso">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Camera viewfinder"
        className={cn(
          "absolute inset-0 size-full object-cover",
          state === "requesting" || state === "denied" || state === "nocamera"
            ? "opacity-0"
            : "opacity-100"
        )}
      />

      {(scanning || done) && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-5" aria-hidden>
          <div className="relative mx-auto mt-8 aspect-square w-2/3 max-w-60">
            {done && <div className="absolute -inset-3 rounded-xl bg-good/25 animate-pop" />}
            {(
              [
                "left-0 top-0 rounded-tl-xl border-l-[3px] border-t-[3px]",
                "right-0 top-0 rounded-tr-xl border-r-[3px] border-t-[3px]",
                "bottom-0 left-0 rounded-bl-xl border-b-[3px] border-l-[3px]",
                "bottom-0 right-0 rounded-br-xl border-b-[3px] border-r-[3px]",
              ] as const
            ).map((pos) => (
              <span
                key={pos}
                className={cn(
                  "absolute size-8",
                  pos,
                  done ? "border-good" : "border-cream/85 animate-pulse"
                )}
              />
            ))}
          </div>
          <p className="rounded-full bg-espresso/70 px-4 py-1.5 text-center text-[13px] text-cream/85">
            {done ? "Card found" : "Point the camera at the QR on the Foodline Card"}
          </p>
        </div>
      )}

      {state === "requesting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-espresso px-6 text-center text-cream">
          <div className="flex size-14 items-center justify-center rounded-full bg-cream/10">
            <Camera className="size-6" aria-hidden />
          </div>
          <p className="font-medium">Waiting for camera permission</p>
          <p className="max-w-60 text-[13px] leading-relaxed text-cream/70">
            We use your camera only to scan the QR on a customer&rsquo;s Foodline Card.
          </p>
          <Loader2 className="size-4 animate-spin text-cream/60" aria-hidden />
        </div>
      )}

      {(state === "denied" || state === "nocamera") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-espresso px-6 text-center text-cream">
          <div className="flex size-14 items-center justify-center rounded-full bg-cream/10">
            <CameraOff className="size-6" aria-hidden />
          </div>
          <p className="font-medium">
            {state === "denied" ? "Camera access is blocked" : "No camera on this device"}
          </p>
          <p className="max-w-64 text-[13px] leading-relaxed text-cream/70">
            {state === "denied"
              ? "Allow camera access for this site in your browser settings, or enter the short code printed on the card instead."
              : "You can still accept the card by entering the short code printed on it."}
          </p>
          <Button variant="secondary" size="md" className="mt-1" onClick={onSwitchToCode}>
            Enter code instead
          </Button>
        </div>
      )}
    </div>
  );
}
