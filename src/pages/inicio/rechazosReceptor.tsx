import { Card, Col, Row, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { Dayjs } from "dayjs";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { TIPOS_DOC } from "../../constants/cfe";
import { documentoId } from "../../providers/dataProvider";

interface Motivo {
  motivo: string;
  glosa?: string | null;
  cantidad: number;
}

interface Listado {
  idSobre: number;
  idTipoDoc?: number | null;
  serie?: string | null;
  nro?: number | null;
}

interface FilaEmpresa {
  rut?: string | null;
  razon?: string | null;
  cantidad: number;
  motivos: Motivo[];
  /** Hasta 20 por empresa */
  listados: Listado[];
}

interface Contador {
  total: number;
  porEmpresa: FilaEmpresa[];
}

/** Respuesta de GET /empresa/:rut/rechazosReceptor */
export interface RechazosReceptor {
  desde: string;
  hasta: string;
  /** Sobres que el receptor rechazo enteros (respuesta M_ con BS) */
  sobres: Contador;
  /** Comprobantes que el receptor rechazo (respuesta ME_ con BE) */
  cfes: Contador;
}

const tipo = (id: number) => TIPOS_DOC.find((t) => t.id === id)?.label ?? String(id);

const motivos = (lista: Motivo[]) =>
  lista.length === 0 ? (
    <Typography.Text type="secondary">sin motivo en la respuesta</Typography.Text>
  ) : (
    <Space size={[4, 4]} wrap>
      {lista.map((m) => (
        <Tooltip key={m.motivo} title={m.glosa ?? undefined}>
          <Tag color="red">
            {m.motivo}
            {m.cantidad > 1 ? ` ×${m.cantidad}` : ""}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );

const empresa = (f: FilaEmpresa) => (
  <Space direction="vertical" size={0}>
    <Typography.Text>{f.razon ?? "-"}</Typography.Text>
    {f.rut && <Typography.Text type="secondary">{f.rut}</Typography.Text>}
  </Space>
);

function Tabla({
  titulo,
  contador,
  detalle,
}: {
  titulo: string;
  contador: Contador;
  detalle: (f: FilaEmpresa) => ReactNode;
}) {
  return (
    <Card size="small" title={`${titulo} (${contador.total})`}>
      <Table<FilaEmpresa>
        dataSource={contador.porEmpresa}
        rowKey={(f) => f.rut ?? "-"}
        size="small"
        pagination={false}
        scroll={{ x: true }}
      >
        <Table.Column<FilaEmpresa> title="Empresa receptora" render={(_, f) => empresa(f)} />
        <Table.Column<FilaEmpresa> title="Cantidad" dataIndex="cantidad" align="right" />
        <Table.Column<FilaEmpresa> title="Motivos" render={(_, f) => motivos(f.motivos)} />
        <Table.Column<FilaEmpresa> title="Detalle" render={(_, f) => detalle(f)} />
      </Table>
    </Card>
  );
}

/**
 * Rechazos de las empresas receptoras en el periodo, en dos contadores separados: sobres rechazados enteros (M_ con BS)
 * y comprobantes rechazados (ME_ con BE), cada uno por empresa y motivo. No se muestra si no hay ninguno.
 */
export function RechazosReceptorCard({
  datos,
  desde,
  hasta,
}: {
  datos?: RechazosReceptor;
  desde: Dayjs;
  hasta: Dayjs;
}) {
  if (!datos || (datos.sobres.total === 0 && datos.cfes.total === 0)) return null;

  const urlSobres = (rut?: string | null) =>
    `/sobres?${new URLSearchParams({
      direccion: "EMITIDO",
      respuestaM: "BS",
      desde: desde.format("YYYY-MM-DD"),
      hasta: hasta.format("YYYY-MM-DD"),
      ...(rut ? { rutContraparte: rut } : {}),
    })}`;

  return (
    <Row gutter={[16, 16]}>
      {datos.sobres.total > 0 && (
        <Col xs={24} xl={datos.cfes.total > 0 ? 12 : 24}>
          <Tabla
            titulo="Sobres rechazados por receptores"
            contador={datos.sobres}
            detalle={(f) => (
              <Space size={[8, 4]} wrap>
                <Link to={urlSobres(f.rut)}>ver sobres</Link>
                {f.listados.length === 1 && (
                  <Link to={`/sobres/show/${f.listados[0].idSobre}`}>sobre {f.listados[0].idSobre}</Link>
                )}
              </Space>
            )}
          />
        </Col>
      )}
      {datos.cfes.total > 0 && (
        <Col xs={24} xl={datos.sobres.total > 0 ? 12 : 24}>
          <Tabla
            titulo="CFE rechazados por receptores"
            contador={datos.cfes}
            detalle={(f) => (
              <Space size={[8, 4]} wrap>
                {f.listados.map((c) =>
                  c.idTipoDoc != null && c.serie && c.nro != null ? (
                    <Link
                      key={`${c.idTipoDoc}|${c.serie}|${c.nro}`}
                      to={`/documentos/show/${encodeURIComponent(documentoId(c.idTipoDoc, c.serie, c.nro))}?direccion=EMITIDO`}
                    >
                      {tipo(c.idTipoDoc)} {c.serie}-{c.nro}
                    </Link>
                  ) : null,
                )}
                {f.cantidad > f.listados.length && (
                  <Typography.Text type="secondary">y {f.cantidad - f.listados.length} más</Typography.Text>
                )}
              </Space>
            )}
          />
        </Col>
      )}
    </Row>
  );
}
