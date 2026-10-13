import { Descriptions, Typography } from "antd";
import { useMemo } from "react";
import type { Sobre, DocumentoRef } from "./useSobre";

const NS_CFE = "http://cfe.dgi.gub.uy";

/** Campos del CFE agregados en los formatos de DGI 1.40+ (se muestran solo los que vienen en el XML) */
const CAMPOS: { elemento: string; etiqueta: string }[] = [
  { elemento: "NroInterno", etiqueta: "Nro interno" },
  { elemento: "FchValor", etiqueta: "Fecha valor" },
  { elemento: "ModVenta", etiqueta: "Modalidad de venta" },
  { elemento: "IVAalDia", etiqueta: "IVA al día" },
  { elemento: "SecProf", etiqueta: "Servicios profesionales" },
  { elemento: "IndPagCta3Ros", etiqueta: "Pago por cuenta de terceros" },
  { elemento: "IndCobPropia", etiqueta: "Cobranza propia" },
  { elemento: "InfoAdicionalDoc", etiqueta: "Información adicional" },
  { elemento: "InfoAdicionalEmisor", etiqueta: "Información adicional del emisor" },
  { elemento: "CAEEspecial", etiqueta: "CAE especial" },
  { elemento: "CausalCAEEsp", etiqueta: "Causal del CAE especial" },
  { elemento: "IndPropiedad", etiqueta: "Mercadería de terceros" },
  { elemento: "TipoDocProp", etiqueta: "Tipo de documento del propietario" },
  { elemento: "CodPaisProp", etiqueta: "País del propietario" },
  { elemento: "DocProp", etiqueta: "Documento del propietario" },
  { elemento: "DocPropExt", etiqueta: "Documento del propietario (extranjero)" },
  { elemento: "RznSocProp", etiqueta: "Razón social del propietario" },
];

const texto = (padre: Element, nombre: string) =>
  padre.getElementsByTagNameNS(NS_CFE, nombre)[0]?.textContent?.trim() || null;

/** El CFE del sobre con ese tipo, serie y numero (el numero se compara como numero: hay emisores que lo rellenan con ceros) */
function buscarCfe(xml: string, ref: DocumentoRef): Element | null {
  const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, "").trim(), "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  for (const cfe of Array.from(doc.getElementsByTagNameNS(NS_CFE, "CFE"))) {
    const idDoc = cfe.getElementsByTagNameNS(NS_CFE, "IdDoc")[0];
    if (!idDoc) continue;
    if (
      Number(texto(idDoc, "TipoCFE")) === ref.idTipoDoc &&
      texto(idDoc, "Serie") === ref.serie &&
      Number(texto(idDoc, "Nro")) === Number(ref.nro)
    )
      return cfe;
  }
  return null;
}

/**
 * Datos del CFE que trae el XML del sobre y no se guardan aparte (formatos de DGI 1.40+): nro interno, CAE especial,
 * fecha valor, indicadores... Solo se muestra si el CFE tiene alguno.
 */
export function DatosAdicionalesCfe({
  sobre,
  documento,
  direccion,
}: {
  sobre: Sobre | null | undefined;
  documento: DocumentoRef | undefined;
  direccion: string;
}) {
  const datos = useMemo(() => {
    const xml = direccion === "RECIBIDO" ? sobre?.xmlEmpresa : sobre?.xmlDgi;
    if (!xml || !documento) return [];
    const cfe = buscarCfe(xml, documento);
    if (!cfe) return [];
    const encontrados = CAMPOS.map((c) => ({ ...c, valor: texto(cfe, c.elemento) })).filter((c) => c.valor);
    // Retenciones/percepciones con informacion adicional (puede haber varias)
    const infoRet = Array.from(cfe.getElementsByTagNameNS(NS_CFE, "InfoAdicionalRet"))
      .map((e) => e.textContent?.trim())
      .filter(Boolean);
    if (infoRet.length > 0)
      encontrados.push({ elemento: "InfoAdicionalRet", etiqueta: "Información de retenciones", valor: infoRet.join("; ") });
    return encontrados;
  }, [sobre, documento, direccion]);

  if (datos.length === 0) return null;
  return (
    <>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Datos adicionales
      </Typography.Title>
      <Descriptions bordered size="small" column={2}>
        {datos.map((d) => (
          <Descriptions.Item key={d.elemento} label={d.etiqueta}>
            {d.valor}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </>
  );
}
