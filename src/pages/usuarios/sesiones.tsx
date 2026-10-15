import { Alert, Table, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";
import { navegador } from "../../utils/userAgent";
import { ordenar } from "../../utils/orden";

type Estado =
  "VIGENTE" | "VENCIDA_INACTIVIDAD" | "VENCIDA_DURACION" | "CERRADA";

interface Sesion {
  creada?: string | null;
  ultimoAcceso?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  estado: Estado;
}

const ESTADOS: Record<Estado, { label: string; color: string; ayuda: string }> =
  {
    VIGENTE: {
      label: "Vigente",
      color: "green",
      ayuda: "Dentro de los límites de inactividad y duración",
    },
    VENCIDA_INACTIVIDAD: {
      label: "Vencida (inactividad)",
      color: "orange",
      ayuda:
        "Sin uso por más tiempo que el límite de inactividad: con expiración en ENFORCE se rechazaría",
    },
    VENCIDA_DURACION: {
      label: "Vencida (duración)",
      color: "orange",
      ayuda:
        "Superó la duración máxima desde el login: con expiración en ENFORCE se rechazaría",
    },
    CERRADA: {
      label: "Cerrada",
      color: "default",
      ayuda: "Marcada como no válida",
    },
  };

/** Sesiones de un usuario (las 100 más recientes), se cargan al expandir la fila */
export function SesionesUsuario({ uid }: { uid: number }) {
  const [datos, setDatos] = useState<{ total: number; sesiones: Sesion[] }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiJson<{ total: number; sesiones: Sesion[] }>(
      "GET",
      `/usuarios/${uid}/sesiones`,
    )
      .then(setDatos)
      .catch((e: Error) => setError(e.message));
  }, [uid]);

  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudieron obtener las sesiones"
        description={error}
      />
    );

  return (
    <>
      <Table<Sesion>
        dataSource={datos?.sesiones ?? []}
        rowKey={(_, i) => String(i)}
        size="small"
        loading={!datos}
        pagination={{ pageSize: 10, size: "small", hideOnSinglePage: true }}
        locale={{ emptyText: "Sin sesiones" }}
        scroll={{ x: true }}
      >
        <Table.Column<Sesion>
          title="Estado"
          sorter={ordenar<Sesion>((s) => ESTADOS[s.estado]?.label ?? s.estado)}
          render={(_, s) => (
            <Tooltip title={ESTADOS[s.estado]?.ayuda}>
              <Tag color={ESTADOS[s.estado]?.color}>
                {ESTADOS[s.estado]?.label ?? s.estado}
              </Tag>
            </Tooltip>
          )}
        />
        <Table.Column<Sesion>
          title="Inicio (login)"
          sorter={ordenar<Sesion>((s) => s.creada)}
          render={(_, s) => (
            <span style={{ whiteSpace: "nowrap" }}>
              {formatFechaApi(s.creada) || "-"}
            </span>
          )}
        />
        <Table.Column<Sesion>
          title="Último acceso"
          sorter={ordenar<Sesion>((s) => s.ultimoAcceso)}
          render={(_, s) => (
            <span style={{ whiteSpace: "nowrap" }}>
              {s.ultimoAcceso ? (
                formatFechaApi(s.ultimoAcceso)
              ) : (
                <Tooltip title="No se registró uso después del login (el registro empezó con la expiración de sesiones)">
                  <Typography.Text type="secondary">-</Typography.Text>
                </Tooltip>
              )}
            </span>
          )}
        />
        <Table.Column<Sesion>
          title="IP"
          dataIndex="ip"
          sorter={ordenar<Sesion>((s) => s.ip)}
          render={(ip?: string | null) => ip ?? "-"}
        />
        <Table.Column<Sesion>
          title="Navegador"
          sorter={ordenar<Sesion>((s) => navegador(s.userAgent))}
          render={(_, s) => (
            <Tooltip title={s.userAgent}>
              <span>{navegador(s.userAgent)}</span>
            </Tooltip>
          )}
        />
      </Table>
      {datos && datos.total > datos.sesiones.length && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Se muestran las {datos.sesiones.length} más recientes de {datos.total}
          .
        </Typography.Text>
      )}
    </>
  );
}
