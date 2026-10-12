import { Alert, Descriptions, Space, Table, Tag, Typography } from "antd";
import { tagEstadoReporte } from "./estado";
import { tipoDocByName, TIPOS_DOC } from "../../constants/cfe";
import {
  ETIQUETAS_MONTOS,
  type ItemMontos,
  type Rango,
  type ResumenTipo,
  parsearReporte,
  parsearRespuesta,
} from "../../utils/reporte";

const tipoLabel = (tipoComp?: number, seccion?: string) => {
  const tipo =
    TIPOS_DOC.find((t) => t.id === tipoComp) ?? tipoDocByName(seccion);
  return tipo
    ? `${tipo.id} - ${tipo.label}`
    : tipoComp
      ? String(tipoComp)
      : (seccion ?? "-");
};

const formatoMonto = (valor?: string) => {
  const n = Number(valor);
  return valor === undefined || valor === "" || isNaN(n)
    ? (valor ?? "-")
    : n.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

/** "yyyy-MM-ddTHH:mm:ss.SSS-03:00" -> "yyyy-MM-dd HH:mm:ss" */
const formatoTimestamp = (valor?: string) =>
  valor ? valor.replace("T", " ").slice(0, 19) : "-";

const rangosTexto = (rangos: Rango[]) =>
  rangos.length === 0 ? (
    <Typography.Text type="secondary">-</Typography.Text>
  ) : (
    <Space size={4} wrap>
      {rangos.map((r, i) => (
        <Tag key={i}>
          {r.desde === r.hasta
            ? `${r.serie}-${r.desde}`
            : `${r.serie}-${r.desde} a ${r.serie}-${r.hasta}`}
        </Tag>
      ))}
    </Space>
  );

const totalTipo = (resumen: ResumenTipo) => {
  const valores = resumen.montos
    .map((m) => Number(m.TotMntTotal))
    .filter((n) => !isNaN(n));
  return valores.length ? valores.reduce((a, b) => a + b, 0) : undefined;
};

/** Montos de un tipo: una fila por item (fecha / sucursal), solo las columnas con algun valor distinto de cero */
function TablaMontos({ items }: { items: ItemMontos[] }) {
  const claves = Array.from(
    new Set(items.flatMap((i) => Object.keys(i))),
  ).filter(
    (clave) =>
      ["Fecha", "CodSuc"].includes(clave) ||
      items.some((i) => Number(i[clave]) !== 0),
  );
  return (
    <Table<ItemMontos>
      dataSource={items.map((item, i) => ({ ...item, _key: String(i) }))}
      rowKey="_key"
      size="small"
      pagination={false}
      scroll={{ x: true }}
    >
      {claves.map((clave) => (
        <Table.Column<ItemMontos>
          key={clave}
          title={ETIQUETAS_MONTOS[clave] ?? clave}
          dataIndex={clave}
          align={["Fecha", "CodSuc"].includes(clave) ? "left" : "right"}
          render={(valor: string) =>
            ["Fecha", "CodSuc"].includes(clave) || clave.startsWith("IVATasa")
              ? valor
              : formatoMonto(valor)
          }
        />
      ))}
    </Table>
  );
}

/** Contenido de un reporte diario, interpretado a partir del XML enviado y de la respuesta de DGI */
export function ReporteDetalle({
  xml,
  respuesta,
}: {
  xml?: string | null;
  respuesta?: string | null;
}) {
  const reporte = parsearReporte(xml);
  const ack = parsearRespuesta(respuesta);

  if (!reporte)
    return (
      <Alert
        type="warning"
        showIcon
        message="No se pudo interpretar el XML del reporte"
      />
    );

  const c = reporte.caratula;
  const r = ack?.caratula ?? {};

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions bordered size="small" column={3} title="Carátula">
        <Descriptions.Item label="Fecha resumida">
          {c.FechaResumen ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Secuencia de envío">
          {c.SecEnvio ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Comprobantes">
          {c.CantComprobantes ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Firmado">
          {formatoTimestamp(c.TmstFirmaEnv)}
        </Descriptions.Item>
        <Descriptions.Item label="Id emisor">
          {c.IDEmisor ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="RUC emisor">
          {c.RUCEmisor ?? "-"}
        </Descriptions.Item>
      </Descriptions>

      {ack && (
        <Descriptions bordered size="small" column={3} title="Respuesta de DGI">
          <Descriptions.Item label="Estado">
            {tagEstadoReporte(ack.estado)}
          </Descriptions.Item>
          <Descriptions.Item label="Recibido">
            {formatoTimestamp(r.FecHRecibido)}
          </Descriptions.Item>
          <Descriptions.Item label="Id DGI">
            {r.IDReceptor ?? "-"}
          </Descriptions.Item>
          {ack.detalle.map((d, i) => (
            <Descriptions.Item key={i} label={d.nombre} span={3}>
              {d.valor}
            </Descriptions.Item>
          ))}
        </Descriptions>
      )}

      <div>
        <Typography.Title level={5}>
          Resumen por tipo de comprobante
        </Typography.Title>
        <Table<ResumenTipo>
          dataSource={reporte.resumenes}
          rowKey={(resumen) => `${resumen.seccion}-${resumen.tipoComp}`}
          size="small"
          pagination={false}
          expandable={{
            rowExpandable: (resumen) => resumen.montos.length > 0,
            expandedRowRender: (resumen) => (
              <TablaMontos items={resumen.montos} />
            ),
          }}
          locale={{ emptyText: "El reporte no tiene comprobantes" }}
        >
          <Table.Column<ResumenTipo>
            title="Tipo"
            render={(_, resumen) =>
              tipoLabel(resumen.tipoComp, resumen.seccion)
            }
          />
          <Table.Column<ResumenTipo>
            title="Emitidos"
            dataIndex="cantEmitidos"
            align="right"
          />
          <Table.Column<ResumenTipo>
            title="Utilizados"
            dataIndex="cantUtilizados"
            align="right"
          />
          <Table.Column<ResumenTipo>
            title="Anulados"
            dataIndex="cantAnulados"
            align="right"
            render={(n?: number) =>
              n ? (
                <Typography.Text type="danger">{n}</Typography.Text>
              ) : (
                (n ?? "-")
              )
            }
          />
          <Table.Column<ResumenTipo>
            title="Rangos utilizados"
            render={(_, resumen) => rangosTexto(resumen.rangosUtilizados)}
          />
          <Table.Column<ResumenTipo>
            title="Rangos anulados"
            render={(_, resumen) => rangosTexto(resumen.rangosAnulados)}
          />
          <Table.Column<ResumenTipo>
            title="Total"
            align="right"
            render={(_, resumen) => {
              const total = totalTipo(resumen);
              return total === undefined ? "-" : formatoMonto(String(total));
            }}
          />
        </Table>
      </div>
    </Space>
  );
}
