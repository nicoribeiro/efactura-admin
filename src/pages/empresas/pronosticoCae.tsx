import { Table, Tag, Tooltip, Typography } from "antd";
import { tipoDocByName, TIPOS_DOC } from "../../constants/cfe";
import {
  DIAS_RITMO,
  textoPronostico,
  type PronosticoCAE,
} from "../../utils/cae";
import { ordenar } from "../../utils/orden";

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

/** Orden de la columna Estado: primero lo mas grave */
const ORDEN_GRAVEDAD = { error: 0, warning: 1, info: 2, ok: 3 };

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
        sorter={ordenar<PronosticoCAE>((p) => p.idTipoDoc)}
        render={(_, p) => etiquetaTipo(p)}
      />
      <Table.Column<PronosticoCAE>
        title="Disponibles"
        dataIndex="disponibles"
        align="right"
        sorter={ordenar<PronosticoCAE>((p) => p.disponibles)}
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
        sorter={ordenar<PronosticoCAE>((p) => p.emitidos)}
      />
      <Table.Column<PronosticoCAE>
        title="Alcanza hasta"
        sorter={ordenar<PronosticoCAE>((p) =>
          p.vigentes === 0 ? null : p.agotamiento?.toDate(),
        )}
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
        sorter={ordenar<PronosticoCAE>((p) => p.vence?.toDate())}
        render={(_, p) => p.vence?.format("DD/MM/YYYY") ?? "-"}
      />
      <Table.Column<PronosticoCAE>
        title="Estado"
        sorter={ordenar<PronosticoCAE>((p) => ORDEN_GRAVEDAD[p.gravedad])}
        render={(_, p) => (
          <Tag color={COLORES[p.gravedad]}>{textoPronostico(p)}</Tag>
        )}
      />
    </Table>
  );
}
