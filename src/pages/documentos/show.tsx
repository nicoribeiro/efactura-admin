import { FilePdfOutlined } from "@ant-design/icons";
import { Show } from "@refinedev/antd";
import { useNotification, useOne } from "@refinedev/core";
import { Button, Descriptions, Table, Tag, Typography } from "antd";
import { useParams, useSearchParams } from "react-router";
import { ESTADOS_CFE, formatFechaApi, tipoDocByName } from "../../constants/cfe";
import { useEmpresa } from "../../contexts/empresa";
import { etiquetaEmpresa, type Documento } from "./list";
import { abrirPdf } from "./pdf";

interface DocumentoDetalle extends Documento {
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
  value != null ? value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

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

  const pdf = async () => {
    if (!doc || !tipo || !empresa) return;
    try {
      await abrirPdf(
        empresa.rut,
        { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro },
        direccion === "RECIBIDO" ? rutExterno : undefined,
      );
    } catch (error) {
      open?.({ type: "error", message: "No se pudo obtener el PDF", description: (error as Error).message });
    }
  };

  const detalle = doc?.detalle ?? [];

  return (
    <Show
      isLoading={query.isLoading}
      title={doc ? `${tipo?.label ?? doc.tipo} ${doc.serie}-${doc.nro}` : "Comprobante"}
      headerButtons={() => (
        <Button icon={<FilePdfOutlined />} onClick={pdf} disabled={!doc}>
          PDF
        </Button>
      )}
    >
      {doc && (
        <>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Tipo">{tipo ? `${tipo.id} - ${tipo.label}` : doc.tipo}</Descriptions.Item>
            <Descriptions.Item label="Serie / Nro">{`${doc.serie}-${doc.nro}`}</Descriptions.Item>
            <Descriptions.Item label="Fecha emisión">{formatFechaApi(doc.fechaEmision)}</Descriptions.Item>
            <Descriptions.Item label="Fecha generación">{formatFechaApi(doc.fechaGeneracion)}</Descriptions.Item>
            <Descriptions.Item label="Emisor">{etiquetaEmpresa(doc.empresaEmisora) ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Receptor">
              {etiquetaEmpresa(doc.empresaReceptora) ?? doc.titular?.documento ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Moneda">{doc.moneda}</Descriptions.Item>
            <Descriptions.Item label="Tipo de cambio">{doc.tipoCambio ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Neto no gravado">{monto(doc.totMntNoGrv)}</Descriptions.Item>
            <Descriptions.Item label="Neto tasa mínima">{monto(doc.totMntIVATasaMin)}</Descriptions.Item>
            <Descriptions.Item label="Neto tasa básica">{monto(doc.totMntIVATasaBas)}</Descriptions.Item>
            <Descriptions.Item label="IVA tasa mínima">{monto(doc.mntIVATasaMin)}</Descriptions.Item>
            <Descriptions.Item label="IVA tasa básica">{monto(doc.mntIVATasaBas)}</Descriptions.Item>
            <Descriptions.Item label="Total">
              <Typography.Text strong>{monto(doc.totMntTotal)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Estado DGI">
              {doc.estado ? (
                <Tag color={ESTADOS_CFE[doc.estado]?.color}>{ESTADOS_CFE[doc.estado]?.label ?? doc.estado}</Tag>
              ) : (
                <Tag>Sin respuesta</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Vencimiento">{formatFechaApi(doc.vencimiento) || "-"}</Descriptions.Item>
            {doc.adenda && (
              <Descriptions.Item label="Adenda" span={2}>
                {doc.adenda}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Detalle
          </Typography.Title>
          <Table dataSource={detalle} rowKey={(_, index) => String(index)} size="small" pagination={false}>
            <Table.Column title="#" dataIndex="nroLinea" />
            <Table.Column title="Ítem" dataIndex="nombreItem" />
            <Table.Column title="Cantidad" dataIndex="cantidad" align="right" />
            <Table.Column title="Unidad" dataIndex="unidadMedida" />
            <Table.Column title="Precio unitario" dataIndex="precioUnitario" align="right" render={monto} />
            <Table.Column title="Monto" dataIndex="montoItem" align="right" render={monto} />
          </Table>
        </>
      )}
    </Show>
  );
}
