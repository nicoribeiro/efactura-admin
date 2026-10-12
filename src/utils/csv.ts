export type Celda = string | number | null | undefined;

/**
 * CSV para Excel en español: separador ";", coma decimal y BOM para que los acentos se lean bien.
 * Los numeros se pasan ya formateados (ver numeroCsv).
 */
export function aCsv(filas: Celda[][]): string {
  const celda = (valor: Celda) => {
    const texto = valor == null ? "" : String(valor);
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return "﻿" + filas.map((fila) => fila.map(celda).join(";")).join("\r\n");
}

/** Numero con coma decimal y sin separador de miles (lo que Excel en español interpreta como numero) */
export const numeroCsv = (n?: number | null, decimales = 2) =>
  n == null ? "" : n.toFixed(decimales).replace(".", ",");

/** Descarga un texto como archivo desde el navegador */
export function descargar(
  nombre: string,
  contenido: string,
  tipo = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
