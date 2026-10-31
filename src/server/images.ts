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

/**
 * Versão única guardada de uma foto: reorientada, no tamanho máximo pedido e sem metadados
 * (EXIF/GPS), mais a miniatura. O PDF e a tela usam esse arquivo; não há original à parte.
 */
export async function storedImage(bytes: Buffer, maxSide: number) {
  const main = await sharp(bytes, { failOn: "error" })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(main.data)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  return { main: main.data, thumb, width: main.info.width, height: main.info.height };
}
