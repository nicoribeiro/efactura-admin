import { Alert, Space, Table, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiJson } from "../../api/http";
import { ESTADOS_CFE, TIPOS_DOC, estadoDgiMostrado, tipoDocByName } from "../../constants/cfe";
import { urlDocumento } from "../../utils/busqueda";
import { ordenar } from "../../utils/orden";
import { referenciasDelXml, type ReferenciaCfe } from "../../utils/referencias";
import type { Documento } from "./list";
import type { EstadoSobre } from "./useSobre";

type Direccion = "EMITIDO" | "RECIBIDO";

/** Documento con la referencia que la API vincula al emitir (solo emitidos) */
export interface DocumentoConReferencia extends Documento {
  referencia?: Documento | null;
  razonReferencia?: string | null;
  obligatorioReferencia?: boolean;
}

const monto = (n?: number | null) =>
  n == null
    ? undefined
    : n.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** Texto del comprobante referenciado, como se ve en la tabla */
const textoReferencia = (r: ReferenciaCfe) =>
  r.global
    ? "Referencia global"
    : `${TIPOS_DOC.find((t) => t.id === r.idTipoDoc)?.label ?? r.idTipoDoc ?? "?"} ${r.serie ?? "?"}-${r.nro ?? "?"}`;

const textoDocumento = (d: Documento) =>
  `${tipoDocByName(d.tipo)?.label ?? d.tipo} ${d.serie}-${d.nro}`;

/** Estado de DGI como se ve en la tabla */
const textoEstado = (d: DocumentoConReferencia) => {
  const estado = estadoDgiMostrado(d.estado, d.sobreEmitido?.estadoDgi);
  return estado ? (ESTADOS_CFE[estado]?.label ?? estado) : "Sin respuesta";
};

const NoInformado = ({ ayuda }: { ayuda: string }) => (
  <Tooltip title={ayuda}>
    <Typography.Text type="warning">No informada</Typography.Text>
  </Tooltip>
);

/**
 * Referencias del comprobante: a cuales referencia (leidas del XML de su sobre, tal como se enviaron) y, en emitidos,
 * cuales lo referencian (notas de credito o debito sobre una factura, por ejemplo).
 */
export function ReferenciasDocumento({
  rut,
  doc,
  documento,
  direccion,
  rutExterno,
  sobre,
}: {
  rut: string;
  doc: DocumentoConReferencia;
  documento: { idTipoDoc: number; serie: string; nro: number };
  direccion: Direccion;
  rutExterno?: string;
  sobre: EstadoSobre;
}) {
  const [referenciadoPor, setReferenciadoPor] = useState<
    DocumentoConReferencia[]
  >([]);
  const { idTipoDoc, serie, nro } = documento;

  // Quienes referencian a este comprobante: solo en emitidos (en recibidos la API no vincula las referencias)
  useEffect(() => {
    if (direccion !== "EMITIDO") return;
    let cancelado = false;
    apiJson<DocumentoConReferencia[]>(
      "GET",
      `/empresa/${rut}/documentos/referenciadoPor`,
      {
        idTipoDoc,
        serie,
        nro,
      },
    )
      .then((r) => !cancelado && setReferenciadoPor(r))
      // Una API sin el endpoint (o un error) solo oculta esta parte
      .catch(() => !cancelado && setReferenciadoPor([]));
    return () => {
      cancelado = true;
    };
  }, [rut, direccion, idTipoDoc, serie, nro]);

  // Referencias tal como figuran en el XML enviado (emitido: el que se envio a DGI; recibido: el que llego)
  const s = sobre.data?.sobre;
  const xml =
    direccion === "EMITIDO" ? (s?.xmlDgi ?? s?.xmlEmpresa) : s?.xmlEmpresa;
  const delXml = referenciasDelXml(xml, documento);
  // Sin XML: la referencia que vinculo la API (sin fecha ni monto informados, que solo estan en el XML)
  const referencias: ReferenciaCfe[] =
    delXml ??
    (doc.referencia
      ? [
          {
            global: false,
            idTipoDoc: tipoDocByName(doc.referencia.tipo)?.id,
            serie: doc.referencia.serie,
            nro: doc.referencia.nro,
            razon: doc.razonReferencia ?? undefined,
          },
        ]
      : []);
  const desdeXml = delXml !== null;

  if (
    sobre.loading ||
    (referencias.length === 0 && referenciadoPor.length === 0)
  )
    return null;

  const urlReferencia = (r: ReferenciaCfe) => {
    const tipo = TIPOS_DOC.find((t) => t.id === r.idTipoDoc);
    return tipo && r.serie && r.nro !== undefined
      ? urlDocumento(
          {
            tipo: tipo.name,
            serie: r.serie,
            nro: r.nro,
            empresaEmisora: { rut: rutExterno },
          },
          direccion,
        )
      : undefined;
  };

  return (
    <>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Referencias
      </Typography.Title>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {referencias.length > 0 && (
          <div>
            <Typography.Text type="secondary">
              Este CFE referencia a{desdeXml ? " (según su XML)" : ""}
            </Typography.Text>
            <Table<ReferenciaCfe>
              dataSource={referencias}
              rowKey={(r, i) => `${r.linea ?? ""}-${i}`}
              size="small"
              pagination={false}
              style={{ marginTop: 8 }}
              scroll={{ x: true }}
            >
              <Table.Column<ReferenciaCfe>
                title="CFE"
                sorter={ordenar<ReferenciaCfe>(textoReferencia)}
                render={(_, r) => {
                  if (r.global) return <Tag>Referencia global</Tag>;
                  const texto = textoReferencia(r);
                  const url = urlReferencia(r);
                  return url ? <Link to={url}>{texto}</Link> : texto;
                }}
              />
              <Table.Column<ReferenciaCfe>
                title="Fecha informada"
                sorter={ordenar<ReferenciaCfe>((r) => (r.global ? null : r.fecha))}
                render={(_, r) =>
                  r.global ? (
                    "-"
                  ) : r.fecha ? (
                    dayjs(r.fecha).format("DD/MM/YYYY")
                  ) : desdeXml ? (
                    <NoInformado ayuda="El XML no trae FechaCFEref: DGI no puede validar que el CFE referenciado exista" />
                  ) : (
                    "-"
                  )
                }
              />
              <Table.Column<ReferenciaCfe>
                title="Monto informado"
                align="right"
                sorter={ordenar<ReferenciaCfe>((r) => (r.global ? null : r.monto))}
                render={(_, r) =>
                  r.global ? (
                    "-"
                  ) : r.monto !== undefined ? (
                    `${r.moneda ?? ""} ${monto(r.monto)}`
                  ) : desdeXml ? (
                    <NoInformado ayuda="El XML no trae MntCFEref" />
                  ) : (
                    "-"
                  )
                }
              />
              <Table.Column<ReferenciaCfe>
                title="Razón"
                sorter={ordenar<ReferenciaCfe>((r) => r.razon)}
                render={(_, r) => r.razon || "-"}
              />
            </Table>
          </div>
        )}

        {referenciadoPor.length > 0 && (
          <div>
            <Typography.Text type="secondary">Referenciado por</Typography.Text>
            <Table<DocumentoConReferencia>
              dataSource={referenciadoPor}
              rowKey="id"
              size="small"
              pagination={false}
              style={{ marginTop: 8 }}
              scroll={{ x: true }}
            >
              <Table.Column<DocumentoConReferencia>
                title="CFE"
                sorter={ordenar<DocumentoConReferencia>(textoDocumento)}
                render={(_, d) => {
                  const texto = textoDocumento(d);
                  const url = urlDocumento(d, "EMITIDO");
                  return url ? <Link to={url}>{texto}</Link> : texto;
                }}
              />
              <Table.Column<DocumentoConReferencia>
                title="Fecha"
                sorter={ordenar<DocumentoConReferencia>((d) => d.fechaEmision)}
                render={(_, d) =>
                  d.fechaEmision
                    ? dayjs(d.fechaEmision.slice(0, 10)).format("DD/MM/YYYY")
                    : "-"
                }
              />
              <Table.Column<DocumentoConReferencia>
                title="Total"
                align="right"
                sorter={ordenar<DocumentoConReferencia>((d) => d.totMntTotal)}
                render={(_, d) =>
                  `${d.moneda ?? ""} ${monto(d.totMntTotal) ?? "-"}`
                }
              />
              <Table.Column<DocumentoConReferencia>
                title="Estado DGI"
                sorter={ordenar<DocumentoConReferencia>(textoEstado)}
                render={(_, d) => {
                  const estado = estadoDgiMostrado(d.estado, d.sobreEmitido?.estadoDgi);
                  return estado ? (
                    <Tag color={ESTADOS_CFE[estado]?.color}>
                      {ESTADOS_CFE[estado]?.label ?? estado}
                    </Tag>
                  ) : (
                    <Tag>Sin respuesta</Tag>
                  );
                }}
              />
              <Table.Column<DocumentoConReferencia>
                title="Razón"
                sorter={ordenar<DocumentoConReferencia>((d) => d.razonReferencia)}
                render={(_, d) => d.razonReferencia || "-"}
              />
            </Table>
          </div>
        )}

        {sobre.error && referencias.length > 0 && !desdeXml && (
          <Alert
            type="info"
            showIcon
            message="No se pudo leer el XML del sobre: se muestra la referencia vinculada por la API, sin fecha ni monto."
          />
        )}
      </Space>
    </>
  );
}
