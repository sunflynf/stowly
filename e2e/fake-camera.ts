import QRCode from "qrcode";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Writes a Y4M video showing a QR code, for Chromium's fake camera
 * (--use-file-for-fake-video-capture). Lets E2E tests drive the real scanner.
 */
export function writeQrVideo(text: string, file = path.join("test-results", "fake-camera", "qr.y4m")) {
  const W = 640;
  const H = 480;
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const scale = Math.floor(300 / (n + 8));
  const size = (n + 8) * scale; // 4-module quiet zone on each side
  const x0 = Math.floor((W - size) / 2);
  const y0 = Math.floor((H - size) / 2);

  const y = Buffer.alloc(W * H, 255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = y0 + (r + 4) * scale + dy;
        y.fill(0, row * W + x0 + (c + 4) * scale, row * W + x0 + (c + 5) * scale);
      }
    }
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]));
  return path.resolve(file);
}
