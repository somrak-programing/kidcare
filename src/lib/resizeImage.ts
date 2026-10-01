import { fitWithin } from "@/domain/imageResize";

export async function resizeToJpegBase64(file: File, maxEdge = 1600, quality = 0.85): Promise<{ mediaType: "image/jpeg"; data: string }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  try {
    const { w, h } = fitWithin(bmp.width, bmp.height, maxEdge);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  } finally {
    bmp.close();
  }
  try {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
    );
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mediaType: "image/jpeg", data: btoa(bin) };
  } finally {
    // release the canvas backing store promptly (matters on mobile)
    canvas.width = 0;
    canvas.height = 0;
  }
}
