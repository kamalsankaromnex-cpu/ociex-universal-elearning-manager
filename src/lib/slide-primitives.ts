import { z } from "zod";
export const media = z
  .string()
  .max(500000)
  .refine(
    (v) =>
      !v ||
      /^assets\/media\/[a-f0-9]{64}\.(png|jpeg|webp|gif)$/.test(v) ||
      /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Upload a supported raster image",
  );
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
