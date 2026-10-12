import { tipoDocByName, type Direccion } from "../constants/cfe";
import { documentoId } from "../providers/dataProvider";

export interface BusquedaComprobante {
  idTipoDoc?: number;
  serie?: string;
  nro: number;
}

/**
 * Interpreta lo escrito en el buscador: "2311", "A-2311", "A2311", "a 2311", "111 A-2311" (tipo, serie y numero;
 * el tipo de 3 digitos debe ir separado del resto).
 */
export function parseBusqueda(texto: string): BusquedaComprobante | null {
  const m = /^(?:(\d{3})[\s-]+)?(?:([A-Za-z]{1,2})[\s-]*)?(\d{1,10})$/.exec(
    texto.trim(),
  );
  if (!m) return null;
  return {
    idTipoDoc: m[1] ? Number(m[1]) : undefined,
    serie: m[2]?.toUpperCase(),
    nro: Number(m[3]),
  };
}

/** URL del detalle de un comprobante (los recibidos se identifican tambien por el RUT del emisor) */
export function urlDocumento(
  doc: {
    tipo: string;
    serie: string;
    nro: number;
    empresaEmisora?: { rut?: string } | null;
  },
  direccion: Direccion,
) {
  const tipo = tipoDocByName(doc.tipo);
  if (!tipo) return undefined;
  const params = new URLSearchParams({ direccion });
  if (direccion === "RECIBIDO" && doc.empresaEmisora?.rut)
    params.set("rutExterno", doc.empresaEmisora.rut);
  return `/documentos/show/${encodeURIComponent(documentoId(tipo.id, doc.serie, doc.nro))}?${params}`;
}
