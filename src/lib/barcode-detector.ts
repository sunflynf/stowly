"use client";

export type BarcodeFormat = "qr_code" | "ean_13" | "ean_8" | "upc_a" | "upc_e" | "code_128" | "code_39" | "itf";

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface NativeDetectorCtor {
  new (options?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Native BarcodeDetector where available (Chrome on Android, Edge…), otherwise
 * the ZXing WebAssembly ponyfill (iOS Safari, Firefox, desktop). The .wasm is
 * self-hosted under /vendor, copied there on install.
 */
export async function createDetector(formats: BarcodeFormat[]): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? [];
      const usable = formats.filter((f) => supported.includes(f));
      if (usable.length) return new Native({ formats: usable });
    } catch {
      // Fall through to the ponyfill.
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (file: string, prefix: string) => (file.endsWith(".wasm") ? `/vendor/${file}` : prefix + file),
    },
  });
  return new BarcodeDetector({ formats });
}

export function cameraAvailable() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}
