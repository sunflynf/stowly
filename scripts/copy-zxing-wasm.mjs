// Copies the ZXing reader .wasm used by the barcode-detector ponyfill into
// public/vendor so it is served by the app itself (no third-party CDN).
// Runs on postinstall.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// Resolve zxing-wasm from barcode-detector's own dependency (exact matching version).
const detectorEntry = require.resolve("barcode-detector/ponyfill");
const zxingRequire = createRequire(detectorEntry);
const readerEntry = zxingRequire.resolve("zxing-wasm/reader");
const source = path.join(path.dirname(readerEntry), "../../reader/zxing_reader.wasm");
mkdirSync("public/vendor", { recursive: true });
copyFileSync(source, "public/vendor/zxing_reader.wasm");
console.log("Copied zxing_reader.wasm to public/vendor");
