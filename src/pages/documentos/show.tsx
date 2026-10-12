import { FilePdfOutlined } from "@ant-design/icons";
import { Show } from "@refinedev/antd";
import { useNotification, useOne } from "@refinedev/core";
import { Button, Descriptions, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  ESTADOS_CFE,
  formatFechaDia,
  tipoDocByName,
} from "../../constants/cfe";
import { useEmpresa } from "../../contexts/empresa";
import { etiquetaEmpresa } from "./list";
import { ConsultaDgi } from "./consultaDgi";
import { abrirPdf } from "./pdf";
import { rechazoDgi } from "../../utils/dgi";
import { RechazoDgiAlert } from "./rechazo";
import {
  ReferenciasDocumento,
  type DocumentoConReferencia,
} from "./referencias";
import { SobreDocumentoInfo } from "./sobre";
import { useSobreDocumento } from "./useSobre";

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

  const detalle = doc?.detalle ?? [];

  return (
    <Show
      isLoading={query.isLoading}
      title={
        doc
          ? `${tipo?.label ?? doc.tipo} ${doc.serie}-${doc.nro}`
          : "Comprobante"
      }
      headerButtons={() => (
        <Button icon={<FilePdfOutlined />} onClick={pdf} disabled={!doc}>
          PDF
        </Button>
      )}
    >
      {doc && (
        <>
          {rechazo && <RechazoDgiAlert rechazo={rechazo} />}
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
              {etiquetaEmpresa(doc.empresaEmisora) ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Receptor">
              {etiquetaEmpresa(doc.empresaReceptora) ??
                doc.titular?.documento ??
                "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Moneda">{doc.moneda}</Descriptions.Item>
            <Descriptions.Item label="Tipo de cambio">
              {doc.tipoCambio ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Neto no gravado">
              {monto(doc.totMntNoGrv)}
            </Descriptions.Item>
            <Descriptions.Item label="Neto tasa mínima">
              {monto(doc.totMntIVATasaMin)}
            </Descriptions.Item>
            <Descriptions.Item label="Neto tasa básica">
              {monto(doc.totMntIVATasaBas)}
            </Descriptions.Item>
            <Descriptions.Item label="IVA tasa mínima">
              {monto(doc.mntIVATasaMin)}
            </Descriptions.Item>
            <Descriptions.Item label="IVA tasa básica">
              {monto(doc.mntIVATasaBas)}
            </Descriptions.Item>
            <Descriptions.Item label="Total">
              <Typography.Text strong>{monto(doc.totMntTotal)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Estado DGI">
              {doc.estado ? (
                <Tag color={ESTADOS_CFE[doc.estado]?.color}>
                  {ESTADOS_CFE[doc.estado]?.label ?? doc.estado}
                </Tag>
              ) : (
                <Space size={8} wrap>
                  <Tag>Sin respuesta</Tag>
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
          <Table
            dataSource={detalle}
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={false}
          >
            <Table.Column title="#" dataIndex="nroLinea" />
            <Table.Column title="Ítem" dataIndex="nombreItem" />
            <Table.Column title="Cantidad" dataIndex="cantidad" align="right" />
            <Table.Column title="Unidad" dataIndex="unidadMedida" />
            <Table.Column
              title="Precio unitario"
              dataIndex="precioUnitario"
              align="right"
              render={monto}
            />
            <Table.Column
              title="Monto"
              dataIndex="montoItem"
              align="right"
              render={monto}
            />
          </Table>

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
