import { FilePdfOutlined } from "@ant-design/icons";
import { Show } from "@refinedev/antd";
import { useNotification, useOne } from "@refinedev/core";
import { Alert, Button, Descriptions, Space, Table, Tag, Typography, Tooltip } from "antd";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  AYUDA_RECIBIDO,
  estadoDgiMostrado,
  ESTADOS_CFE,
  formatFechaDia,
  tipoDocByName,
} from "../../constants/cfe";
import { useEmpresa } from "../../contexts/empresa";
import { etiquetaEmpresa } from "./list";
import { ConsultaDgi } from "./consultaDgi";
import { abrirPdf } from "./pdf";
import { EnviosMail } from "./enviosMail";
import { ReenviarMail } from "./reenviarMail";
import { rechazoDgi } from "../../utils/dgi";
import { RechazoDgiAlert } from "./rechazo";
import {
  ReferenciasDocumento,
  type DocumentoConReferencia,
} from "./referencias";
import { DatosAdicionalesCfe } from "./datosAdicionales";
import { SobreDocumentoInfo } from "./sobre";
import { RechazoComercial, RespuestaCfeEstado } from "./respuestaCfe";
import { EmpresaConRutDgi } from "../../components/RutDgi";
import { useSobreDocumento } from "./useSobre";
import { ordenar } from "../../utils/orden";

type Linea = Record<string, unknown>;

/** Valores de las lineas del detalle para ordenar (vienen sin tipo de la API) */
const numeroLinea = (v: unknown) => (v == null || v === "" ? null : Number(v));
const textoLinea = (v: unknown) => (v == null ? null : String(v));

interface DocumentoDetalle extends DocumentoConReferencia {
  fechaGeneracion?: string;
  vencimiento?: string | null;
  tipoCambio?: number;
  formaDePago?: string;
  cae?: unknown;
  adenda?: string;
  totMntNoGrv?: number;
  totMntIVATasaMin?: number;
  totMntIVATasaBas?: number;
  mntIVATasaMin?: number;
  mntIVATasaBas?: number;
  detalle?: Record<string, unknown>[];
  /** Controles de recepcion (E01-E07) que el recibido no paso: "E03 (observado): ...; E07: ..." */
  observacionesRecepcion?: string | null;
  /** Motivos de rechazo del recibido: de los controles (enforce) y comerciales (E20 en adelante, a mano) */
  motivosRechazo?: string[];
  /** Detalle del rechazo comercial (va en la respuesta al emisor) */
  detalleRechazo?: string | null;
}

const monto = (value?: number) =>
  value != null
    ? value.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";

export function DocumentoShow() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { empresa } = useEmpresa();
  const { open } = useNotification();

  const direccion = searchParams.get("direccion") ?? "EMITIDO";
  const rutExterno = searchParams.get("rutExterno") ?? undefined;

  const { result: doc, query } = useOne<DocumentoDetalle>({
    resource: "documentos",
    id: decodeURIComponent(id),
    meta: { rut: empresa?.rut, direccion, rutExterno },
    queryOptions: { enabled: !!empresa },
  });

  const tipo = tipoDocByName(doc?.tipo);
  // Se incrementa cuando DGI responde, para recargar el sobre
  const [recargaSobre, setRecargaSobre] = useState(0);
  // Se incrementa al reenviar por mail, para recargar el historial de envios
  const [recargaEnvios, setRecargaEnvios] = useState(0);

  // El sobre se carga una vez: lo usan el aviso de rechazo (arriba) y la seccion Sobre (abajo)
  const referencia =
    doc && tipo
      ? { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro }
      : undefined;
  const sobre = useSobreDocumento(
    empresa?.rut,
    referencia,
    direccion,
    direccion === "RECIBIDO" ? rutExterno : undefined,
    recargaSobre,
  );
  const rechazo = referencia ? rechazoDgi(sobre.data?.sobre, referencia) : null;

  const pdf = async () => {
    if (!doc || !tipo || !empresa) return;
    try {
      await abrirPdf(
        empresa.rut,
        { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro },
        direccion === "RECIBIDO" ? rutExterno : undefined,
      );
    } catch (error) {
      open?.({
        type: "error",
        message: "No se pudo obtener el PDF",
        description: (error as Error).message,
      });
    }
  };

  // La API no garantiza el orden de las lineas
  const detalle = [...(doc?.detalle ?? [])].sort(
    (a, b) => Number(a.nroLinea) - Number(b.nroLinea),
  );
  // Columnas de descuento y recargo solo si alguna linea los tiene
  const conDescuento = detalle.some(
    (d) => Number(d.descuentoMonto) || Number(d.descuentoPct),
  );
  const conRecargo = detalle.some(
    (d) => Number(d.recargoMonto) || Number(d.recargoPct),
  );

  return (
    <Show
      isLoading={query.isLoading}
      title={
        doc
          ? `${tipo?.label ?? doc.tipo} ${doc.serie}-${doc.nro}`
          : "CFE"
      }
      headerButtons={() => (
        <Space>
          {direccion === "EMITIDO" && empresa && referencia && (
            <ReenviarMail
              rut={empresa.rut}
              documento={referencia}
              onEnviado={() => setRecargaEnvios((n) => n + 1)}
            />
          )}
          <Button icon={<FilePdfOutlined />} onClick={pdf} disabled={!doc}>
            PDF
          </Button>
        </Space>
      )}
    >
      {doc && (
        <>
          {rechazo && <RechazoDgiAlert rechazo={rechazo} />}
          {doc.observacionesRecepcion && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Controles de recepción no superados"
              description={
                <Space direction="vertical" size={2}>
                  {doc.observacionesRecepcion.split("; ").map((o, i) => (
                    <span key={i}>{o}</span>
                  ))}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Los controles marcados como «observado» no rechazan el CFE: solo quedan registrados.
                  </Typography.Text>
                </Space>
              }
            />
          )}
          {direccion === "RECIBIDO" && empresa && sobre.data?.sobre && (
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Respuesta al emisor">
                <Space direction="vertical" size={8}>
                  <RespuestaCfeEstado
                    rut={empresa.rut}
                    sobre={sobre.data.sobre}
                    onEnviada={() => {
                      query.refetch();
                      setRecargaSobre((n) => n + 1);
                      setRecargaEnvios((n) => n + 1);
                    }}
                  />
                  <RechazoComercial
                    rut={empresa.rut}
                    cfeId={doc.id}
                    motivos={doc.motivosRechazo ?? []}
                    detalle={doc.detalleRechazo}
                    pendiente={!!sobre.data.sobre.respuestaCfePendiente && !sobre.data.sobre.respuestaCfes}
                    onCambio={() => query.refetch()}
                  />
                </Space>
              </Descriptions.Item>
            </Descriptions>
          )}
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Tipo">
              {tipo ? `${tipo.id} - ${tipo.label}` : doc.tipo}
            </Descriptions.Item>
            <Descriptions.Item label="Serie / Nro">{`${doc.serie}-${doc.nro}`}</Descriptions.Item>
            <Descriptions.Item label="Fecha emisión">
              {formatFechaDia(doc.fechaEmision)}
            </Descriptions.Item>
            <Descriptions.Item label="Fecha generación">
              {formatFechaDia(doc.fechaGeneracion)}
            </Descriptions.Item>
            <Descriptions.Item label="Emisor">
              <EmpresaConRutDgi
                etiqueta={etiquetaEmpresa(doc.empresaEmisora) ?? "-"}
                rut={doc.empresaEmisora?.rut}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Receptor">
              <EmpresaConRutDgi
                etiqueta={
                  etiquetaEmpresa(doc.empresaReceptora) ??
                  doc.titular?.documento ??
                  "-"
                }
                rut={doc.empresaReceptora?.rut ?? doc.titular?.documento}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Estado DGI">
              {doc.estado ? (
                <Tag color={ESTADOS_CFE[doc.estado]?.color}>
                  {ESTADOS_CFE[doc.estado]?.label ?? doc.estado}
                </Tag>
              ) : (
                <Space size={8} wrap>
                  {direccion === "EMITIDO" &&
                  estadoDgiMostrado(doc.estado, sobre.data?.sobre?.estadoDgi) === "RECIBIDO" ? (
                    <Tooltip title={AYUDA_RECIBIDO}>
                      <Tag color={ESTADOS_CFE.RECIBIDO.color}>{ESTADOS_CFE.RECIBIDO.label}</Tag>
                    </Tooltip>
                  ) : (
                    <Tag>Sin respuesta</Tag>
                  )}
                  {direccion === "EMITIDO" && empresa && referencia && (
                    <ConsultaDgi
                      rut={empresa.rut}
                      documento={referencia}
                      fechaConsulta={sobre.data?.sobre?.fechaConsulta}
                      onRespuesta={() => {
                        query.refetch();
                        setRecargaSobre((n) => n + 1);
                      }}
                    />
                  )}
                </Space>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Vencimiento">
              {formatFechaDia(doc.vencimiento) || "-"}
            </Descriptions.Item>
            {doc.adenda && (
              <Descriptions.Item label="Adenda" span={2}>
                {doc.adenda}
              </Descriptions.Item>
            )}
          </Descriptions>

          <DatosAdicionalesCfe sobre={sobre.data?.sobre} documento={referencia} direccion={direccion} />

          {empresa && referencia && (
            <ReferenciasDocumento
              rut={empresa.rut}
              doc={doc}
              documento={referencia}
              direccion={direccion === "RECIBIDO" ? "RECIBIDO" : "EMITIDO"}
              rutExterno={rutExterno}
              sobre={sobre}
            />
          )}

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Detalle
          </Typography.Title>
          <Table<Linea>
            dataSource={detalle}
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={false}
          >
            <Table.Column<Linea>
              title="#"
              dataIndex="nroLinea"
              sorter={ordenar<Linea>((d) => numeroLinea(d.nroLinea))}
            />
            <Table.Column<Linea>
              title="Ítem"
              dataIndex="nombreItem"
              sorter={ordenar<Linea>((d) => textoLinea(d.nombreItem))}
            />
            <Table.Column<Linea>
              title="Cantidad"
              dataIndex="cantidad"
              align="right"
              sorter={ordenar<Linea>((d) => numeroLinea(d.cantidad))}
            />
            <Table.Column<Linea>
              title="Unidad"
              dataIndex="unidadMedida"
              sorter={ordenar<Linea>((d) => textoLinea(d.unidadMedida))}
            />
            <Table.Column<Linea>
              title="Precio unitario"
              dataIndex="precioUnitario"
              align="right"
              sorter={ordenar<Linea>((d) => numeroLinea(d.precioUnitario))}
              render={monto}
            />
            {conDescuento && (
              <Table.Column<Record<string, unknown>>
                title="Descuento"
                align="right"
                sorter={ordenar<Linea>((d) => Number(d.descuentoMonto) || null)}
                render={(_, d) =>
                  Number(d.descuentoMonto)
                    ? `${monto(Number(d.descuentoMonto))}${Number(d.descuentoPct) ? ` (${Number(d.descuentoPct)}%)` : ""}`
                    : "-"
                }
              />
            )}
            {conRecargo && (
              <Table.Column<Record<string, unknown>>
                title="Recargo"
                align="right"
                sorter={ordenar<Linea>((d) => Number(d.recargoMonto) || null)}
                render={(_, d) =>
                  Number(d.recargoMonto)
                    ? `${monto(Number(d.recargoMonto))}${Number(d.recargoPct) ? ` (${Number(d.recargoPct)}%)` : ""}`
                    : "-"
                }
              />
            )}
            <Table.Column<Linea>
              title="Monto"
              dataIndex="montoItem"
              align="right"
              sorter={ordenar<Linea>((d) => numeroLinea(d.montoItem))}
              render={monto}
            />
          </Table>

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Totales
          </Typography.Title>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Moneda">{doc.moneda}</Descriptions.Item>
            <Descriptions.Item label="Tipo de cambio">
              {doc.tipoCambio || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Neto tasa mínima">
              {monto(doc.totMntIVATasaMin)}
            </Descriptions.Item>
            <Descriptions.Item label="IVA tasa mínima">
              {monto(doc.mntIVATasaMin)}
            </Descriptions.Item>
            <Descriptions.Item label="Neto tasa básica">
              {monto(doc.totMntIVATasaBas)}
            </Descriptions.Item>
            <Descriptions.Item label="IVA tasa básica">
              {monto(doc.mntIVATasaBas)}
            </Descriptions.Item>
            <Descriptions.Item label="Neto no gravado">
              {monto(doc.totMntNoGrv)}
            </Descriptions.Item>
            <Descriptions.Item label="Total">
              <Typography.Text strong>{monto(doc.totMntTotal)}</Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          {empresa && referencia && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24 }}>
                Envíos por mail
              </Typography.Title>
              {direccion === "EMITIDO" ? (
                <EnviosMail rut={empresa.rut} documento={referencia} recarga={recargaEnvios} />
              ) : sobre.data?.sobre?.id ? (
                <EnviosMail rut={empresa.rut} sobreId={sobre.data.sobre.id} recarga={recargaEnvios} />
              ) : (
                <Typography.Text type="secondary">Sin sobre</Typography.Text>
              )}
            </>
          )}

          {empresa && tipo && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24 }}>
                Sobre
              </Typography.Title>
              <SobreDocumentoInfo estado={sobre} />
            </>
          )}
        </>
      )}
    </Show>
  );
}
