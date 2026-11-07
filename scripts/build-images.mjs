import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const localImagePath = src => src.startsWith("/") ? src : `/${src}`;

export async function readImageDimensions(publish, sources) {
  const images = {};

  for (const source of new Set(sources.map(localImagePath))) {
    if (!source.startsWith("/img/") || source.split("/").includes("..") || /[?#\\]/.test(source)) continue;
    let input;
    try {
      input = await readFile(join(publish, source.slice(1)));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const metadata = await sharp(input).metadata();
    const { width, height } = metadata.autoOrient ?? metadata;
    if (!width || !height) continue;

    images[source] = { Width: width, Height: height };
  }
  return images;
}
