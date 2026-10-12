/** Datos de autorizacion (DA) de un CAE de DGI */
export interface CaeDgi {
  rucE: string;
  tcfe: number;
  serie: string;
  dNro: number;
  hNro: number;
  na: number;
  /** Fecha de autorizacion y de vencimiento, yyyy-MM-dd */
  fa?: string;
  fvd: string;
}

/**
 * Lee el XML del CAE que entrega DGI (<CAE><DA>RucE, TCFE, Serie, DNro, HNro, NA, FA, FVD</DA>...). Devuelve un error
 * legible si el archivo no es un CAE o le falta algun dato.
 */
export function leerCaeXml(xml: string): CaeDgi | { error: string } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0)
    return { error: "No es un XML válido" };
  const da = doc.getElementsByTagNameNS("*", "DA")[0];
  if (doc.documentElement.localName !== "CAE" || !da)
    return { error: "No es un CAE de DGI (falta <CAE><DA>)" };

  const valor = (nombre: string) =>
    Array.from(da.children)
      .find((c) => c.localName === nombre)
      ?.textContent?.trim();
  const faltan = ["RucE", "TCFE", "Serie", "DNro", "HNro", "NA", "FVD"].filter(
    (c) => !valor(c),
  );
  if (faltan.length > 0)
    return { error: `Faltan datos en el CAE: ${faltan.join(", ")}` };

  const numero = (nombre: string) => Number(valor(nombre));
  const datos: CaeDgi = {
    rucE: valor("RucE")!,
    tcfe: numero("TCFE"),
    serie: valor("Serie")!,
    dNro: numero("DNro"),
    hNro: numero("HNro"),
    na: numero("NA"),
    fa: valor("FA"),
    fvd: valor("FVD")!.slice(0, 10),
  };
  if (
    [datos.tcfe, datos.dNro, datos.hNro, datos.na].some(
      (n) => !Number.isFinite(n),
    )
  )
    return { error: "Números inválidos en el CAE" };
  return datos;
}
