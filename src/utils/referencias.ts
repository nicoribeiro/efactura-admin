import { arreglarTexto } from "./dgi";

/** Una referencia de un CFE a otro, tal como figura en su XML (Referencia/Referencia) */
export interface ReferenciaCfe {
  linea?: number;
  /** IndGlobal = 1: referencia global (sin un comprobante puntual), se explica en la razon */
  global: boolean;
  idTipoDoc?: number;
  serie?: string;
  nro?: number;
  /** FechaCFEref y MntCFEref: DGI los usa para validar que el comprobante referenciado exista */
  fecha?: string;
  monto?: number;
  moneda?: string;
  razon?: string;
}

const hijo = (el: Element, nombre: string) =>
  Array.from(el.children).find((c) => c.localName === nombre);
const valor = (el: Element, nombre: string) => {
  const t = hijo(el, nombre)?.textContent?.trim();
  return t ? arreglarTexto(t) : undefined;
};
const numero = (t?: string) =>
  t !== undefined && t !== "" && !isNaN(Number(t)) ? Number(t) : undefined;

/**
 * Referencias del comprobante tipo/serie/nro dentro del XML de su sobre (puede traer varios CFE).
 * null si el XML no se puede leer o el comprobante no esta en el.
 */
export function referenciasDelXml(
  xml: string | null | undefined,
  comprobante: { idTipoDoc: number; serie: string; nro: number },
): ReferenciaCfe[] | null {
  if (!xml) return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const cfe = Array.from(doc.getElementsByTagNameNS("*", "CFE")).find((c) => {
    const idDoc = c.getElementsByTagNameNS("*", "IdDoc")[0];
    return (
      idDoc &&
      numero(valor(idDoc, "TipoCFE")) === comprobante.idTipoDoc &&
      valor(idDoc, "Serie") === comprobante.serie &&
      numero(valor(idDoc, "Nro")) === comprobante.nro
    );
  });
  if (!cfe) return null;

  // Contenedor Referencia (hijo de eFact, eTck, ...) con un Referencia por cada comprobante referenciado
  return Array.from(cfe.getElementsByTagNameNS("*", "Referencia"))
    .filter((r) => r.parentElement?.localName === "Referencia")
    .map((r) => ({
      linea: numero(valor(r, "NroLinRef")),
      global: valor(r, "IndGlobal") === "1",
      idTipoDoc: numero(valor(r, "TpoDocRef")),
      serie: valor(r, "Serie"),
      nro: numero(valor(r, "NroCFERef")),
      fecha: valor(r, "FechaCFEref"),
      monto: numero(valor(r, "MntCFEref")),
      moneda: valor(r, "TpoMonedaRef"),
      razon: valor(r, "RazonRef"),
    }));
}
