import fs from "node:fs";
import { PNG } from "pngjs";

let cachedBaseMapPath: string | null = null;
let cachedBaseMapPng: PNG | null = null;

export function loadBaseMapPng(baseMapPath: string): PNG | null {
  if (cachedBaseMapPath !== baseMapPath) {
    cachedBaseMapPath = null;
    cachedBaseMapPng = null;
  }

  if (!baseMapPath) {
    return null;
  }

  if (cachedBaseMapPath === baseMapPath && cachedBaseMapPng) {
    return cachedBaseMapPng;
  }

  if (!fs.existsSync(baseMapPath)) {
    return null;
  }

  const baseMapPng = PNG.sync.read(fs.readFileSync(baseMapPath));

  cachedBaseMapPath = baseMapPath;
  cachedBaseMapPng = baseMapPng;

  return baseMapPng;
}

export function resetBaseMapPngCache(): void {
  cachedBaseMapPath = null;
  cachedBaseMapPng = null;
}
