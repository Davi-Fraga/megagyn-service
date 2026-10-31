import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { storedImage } from "./images";

const canvas = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#c2410c" } });

describe("storedImage", () => {
  it("remove EXIF e GPS", async () => {
    const input = await canvas(800, 600)
      .withExif({ IFD3: { GPSLatitudeRef: "S", GPSLatitude: "16/1 40/1 0/1" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const { main, thumb } = await storedImage(input, 1600);
    expect((await sharp(main).metadata()).exif).toBeUndefined();
    expect((await sharp(thumb).metadata()).exif).toBeUndefined();
  });

  it("respeita a orientação da foto de celular", async () => {
    const input = await canvas(400, 300).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const { main, width, height } = await storedImage(input, 1600);
    expect({ width, height }).toEqual({ width: 300, height: 400 });
    const meta = await sharp(main).metadata();
    expect({ w: meta.width, h: meta.height, o: meta.orientation }).toEqual({ w: 300, h: 400, o: undefined });
  });

  it("limita o maior lado", async () => {
    const { width, height, thumb } = await storedImage(await canvas(3000, 2000).jpeg().toBuffer(), 1600);
    expect({ width, height }).toEqual({ width: 1600, height: 1067 });
    expect((await sharp(thumb).metadata()).width).toBe(480);
  });

  it("não amplia foto pequena", async () => {
    const { width, height } = await storedImage(await canvas(800, 600).jpeg().toBuffer(), 1600);
    expect({ width, height }).toEqual({ width: 800, height: 600 });
  });

  it("converte PNG para JPEG", async () => {
    const { main } = await storedImage(await canvas(100, 100).png().toBuffer(), 1600);
    expect((await sharp(main).metadata()).format).toBe("jpeg");
  });
});
