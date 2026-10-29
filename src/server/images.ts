import sharp from "sharp";

/**
 * Derivadas para tela e PDF. O original fica preservado como evidência;
 * as derivadas são reorientadas e saem sem metadados (EXIF/GPS).
 */
export async function imageDerivatives(bytes: Buffer) {
  const meta = await sharp(bytes, { failOn: "error" }).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  const thumb = await sharp(bytes)
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  const medium = await sharp(bytes)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  return { width: width ?? null, height: height ?? null, thumb, medium };
}
