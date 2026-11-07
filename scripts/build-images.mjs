import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const localImagePath = src => src.startsWith("/") ? src : `/${src}`;

export async function buildImages(publish, sources) {
  const output = join(publish, "_media");
  await mkdir(output, { recursive: true });
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
    const image = sharp(input);
    const metadata = await image.metadata();
    const { width, height } = metadata.autoOrient ?? metadata;
    if (!width || !height) continue;

    const cover = source === "/img/cover.jpg";
    const logo = source === "/img/logo_rastenfeld.jpg";
    const candidates = cover ? [480, 960, 1440] : logo ? [76, 152] : [360, 720, 1080];
    const widths = [...new Set(candidates.map(size => Math.min(size, width)))];
    const hash = createHash("sha256").update("webp-v1").update(input).digest("hex").slice(0, 24);
    const variants = [];
    for (const size of widths) {
      const name = `${hash}-${size}.webp`;
      await image.clone().rotate().resize({ width: size }).webp({ quality: 76 }).toFile(join(output, name));
      variants.push(`/_media/${name}`);
    }
    images[source] = {
      Width: width, Height: height,
      Src: variants[Math.min(1, variants.length - 1)],
      SrcSet: variants.map((path, i) => `${path} ${widths[i]}w`).join(", "),
    };
  }
  return images;
}
