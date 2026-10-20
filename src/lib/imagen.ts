/** Reduce la foto del ticket para subirla rápido aunque la señal sea mala. */
export async function comprimirFoto(archivo: Blob, ladoMaximo = 1600, calidad = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return archivo;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? archivo), 'image/jpeg', calidad));
}

export async function aBase64(blob: Blob): Promise<string> {
  const datos = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  const trozo = 0x8000;
  for (let i = 0; i < datos.length; i += trozo) {
    binario += String.fromCharCode(...datos.subarray(i, i + trozo));
  }
  return btoa(binario);
}
