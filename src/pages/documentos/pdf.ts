import { apiBlob } from "../../api/http";

/** Abre el PDF de un CFE en una pestaña nueva (el endpoint necesita el header AUTH-TOKEN, por eso se descarga como blob) */
export async function abrirPdf(
  rut: string,
  documento: { idTipoDoc: number; serie: string; nro: number },
  rutEmisor?: string,
) {
  const ventana = window.open("", "_blank");
  try {
    const blob = await apiBlob(`/empresa/${rut}/documentos/pdf`, { ...documento, rutEmisor });
    const url = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    ventana?.close();
    throw error;
  }
}
