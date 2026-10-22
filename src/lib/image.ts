"use client";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * 写真を長辺1600pxのJPEGに縮小する。iPhoneの写真（数MB・HEIC）を
 * そのまま保存すると容量と表示速度の両方で重いため。
 * 向き（EXIF）は createImageBitmap の imageOrientation で補正する。
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像を処理できませんでした"))),
      "image/jpeg",
      QUALITY,
    );
  });
}
