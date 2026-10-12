/** Lee un archivo del navegador como base64 (sin el prefijo data:) */
export const aBase64 = (archivo: File) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () =>
      resolve(String(lector.result).replace(/^data:[^,]*,/, ""));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
