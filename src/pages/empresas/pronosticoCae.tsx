import { Table, Tag, Tooltip, Typography } from "antd";
import { tipoDocByName, TIPOS_DOC } from "../../constants/cfe";
import {
  DIAS_RITMO,
  textoPronostico,
  type PronosticoCAE,
} from "../../utils/cae";

const etiquetaTipo = (p: PronosticoCAE) => {
  const t =
    TIPOS_DOC.find((x) => x.id === p.idTipoDoc) ?? tipoDocByName(p.tipo);
  return t ? `${t.id} - ${t.label}` : (p.tipo ?? String(p.idTipoDoc));
};

const COLORES = {
  error: "red",
  warning: "orange",
  info: "default",
  ok: "green",
};

/** Por tipo de documento: numeros disponibles, ritmo de uso y cuando hace falta un CAE nuevo */
export function PronosticoCaeTable({
  filas,
  loading,
}: {
  filas: PronosticoCAE[];
  loading?: boolean;
}) {
  return (
    <Table<PronosticoCAE>
      dataSource={filas}
      rowKey="idTipoDoc"
      size="small"
      pagination={false}
      loading={loading}
      scroll={{ x: true }}
    >
      <Table.Column<PronosticoCAE>
        title="Tipo"
        render={(_, p) => etiquetaTipo(p)}
      />
      <Table.Column<PronosticoCAE>
        title="Disponibles"
        dataIndex="disponibles"
        align="right"
        render={(n: number, p) =>
          p.vigentes > 1 ? (
            <Tooltip title={`Suma de ${p.vigentes} CAE vigentes`}>{n}</Tooltip>
          ) : (
            n
          )
        }
      />
      <Table.Column<PronosticoCAE>
        title={`Emitidos (${DIAS_RITMO} días)`}
        dataIndex="emitidos"
        align="right"
      />
      <Table.Column<PronosticoCAE>
        title="Alcanza hasta"
        render={(_, p) =>
          p.vigentes === 0 ? (
            "-"
          ) : p.agotamiento ? (
            <Tooltip
              title={`Estimado al ritmo de los últimos ${DIAS_RITMO} días`}
            >
              ~{p.agotamiento.format("DD/MM/YYYY")}
            </Tooltip>
          ) : (
            <Typography.Text type="secondary">Sin uso reciente</Typography.Text>
          )
        }
      />
      <Table.Column<PronosticoCAE>
        title="Vence"
        render={(_, p) => p.vence?.format("DD/MM/YYYY") ?? "-"}
      />
      <Table.Column<PronosticoCAE>
        title="Estado"
        render={(_, p) => (
          <Tag color={COLORES[p.gravedad]}>{textoPronostico(p)}</Tag>
        )}
      />
    </Table>
  );
}
