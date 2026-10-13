import { HistoryOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Drawer, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";

/** Ejecucion registrada de un proceso (GET /procesos/:nombre/ejecuciones) */
interface Ejecucion {
  id: number;
  inicio: string | null;
  fin: string | null;
  duracionMs: number | null;
  ok: boolean;
  origen: string | null;
  resumen: string | null;
  /** JSON con el detalle (depende del proceso) o null */
  detalle: string | null;
}

/** Cambio de la sincronizacion de emisores electronicos (EmisoresElectronicos en la API) */
interface CambioEmisor {
  tipo: "nueva" | "actualizada" | "baja";
  rut: string;
  razon: string | null;
  razonAntes?: string | null;
  mail: string | null;
  mailAntes?: string | null;
  emisorElectronico: boolean;
  emisorElectronicoAntes?: boolean;
  fechaFinDgi?: string | null;
}

const COLOR_CAMBIO: Record<string, string> = { nueva: "green", actualizada: "blue", baja: "red" };

const duracion = (ms: number | null) =>
  ms == null ? "-" : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`;

/** El detalle de una ejecucion: los cambios de la sincronizacion de emisores, o el JSON tal cual */
function Detalle({ detalle }: { detalle: string | null }) {
  if (!detalle) return <Typography.Text type="secondary">Sin detalle</Typography.Text>;
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(detalle);
  } catch {
    return <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{detalle}</pre>;
  }
  const cambios = datos.cambios as CambioEmisor[] | undefined;
  if (!Array.isArray(cambios))
    return <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(datos, null, 2)}</pre>;

  const propias = (datos.propiasConOtroMailEnDgi as { rut: string; mailDgi: string; mailRecepcion: string | null }[]) ?? [];
  return (
    <>
      <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Informados por DGI">{String(datos.informadosPorDgi ?? "-")}</Descriptions.Item>
        <Descriptions.Item label="Nuevas">{String(datos.nuevas ?? "-")}</Descriptions.Item>
        <Descriptions.Item label="Actualizadas">{String(datos.actualizadas ?? "-")}</Descriptions.Item>
        <Descriptions.Item label="Bajas">
          {String(datos.bajas ?? "-")}
          {Number(datos.bajasPorFechaVencida) > 0 && ` (${datos.bajasPorFechaVencida} por fecha vencida)`}
        </Descriptions.Item>
        <Descriptions.Item label="Sin cambios">{String(datos.sinCambios ?? "-")}</Descriptions.Item>
        <Descriptions.Item label="Firmada por">{String(datos.firmante ?? "-")}</Descriptions.Item>
      </Descriptions>
      {propias.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Empresas propias con otro mail en DGI (no se modificaron)"
          description={propias.map((p) => `${p.rut}: DGI ${p.mailDgi}, recepción ${p.mailRecepcion ?? "-"}`).join("; ")}
        />
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Ejemplos (hasta 20 de cada tipo):
      </Typography.Text>
      <Table<CambioEmisor>
        size="small"
        rowKey={(c) => `${c.tipo}-${c.rut}`}
        dataSource={cambios}
        pagination={{ pageSize: 10, size: "small" }}
        columns={[
          {
            title: "Cambio",
            dataIndex: "tipo",
            render: (t: string) => <Tag color={COLOR_CAMBIO[t]}>{t}</Tag>,
          },
          { title: "RUT", dataIndex: "rut" },
          {
            title: "Razón social",
            render: (_, c) =>
              c.razonAntes && c.razonAntes !== c.razon ? (
                <>
                  <Typography.Text delete type="secondary">
                    {c.razonAntes}
                  </Typography.Text>{" "}
                  {c.razon}
                </>
              ) : (
                c.razon ?? "-"
              ),
          },
          {
            title: "Mail de intercambio",
            render: (_, c) =>
              c.mailAntes !== undefined && c.mailAntes !== c.mail ? (
                <>
                  <Typography.Text delete type="secondary">
                    {c.mailAntes ?? "-"}
                  </Typography.Text>{" "}
                  {c.mail ?? "-"}
                </>
              ) : (
                c.mail ?? "-"
              ),
          },
          {
            title: "Fin en DGI",
            dataIndex: "fechaFinDgi",
            render: (f?: string | null) => f ?? "-",
          },
        ]}
      />
    </>
  );
}

/** Boton y panel lateral con las ejecuciones registradas de un proceso */
export function EjecucionesProceso({ nombre, titulo }: { nombre: string; titulo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ results: Ejecucion[]; count: number }>();
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(
    (page: number) => {
      setCargando(true);
      setError(undefined);
      apiJson<{ results: Ejecucion[]; count: number }>("GET", `/procesos/${nombre}/ejecuciones`, { page, pageSize: 20 })
        .then(setDatos)
        .catch((e: { message?: string }) => setError(e?.message ?? "Error"))
        .finally(() => setCargando(false));
    },
    [nombre],
  );

  useEffect(() => {
    if (abierto) cargar(pagina);
  }, [abierto, pagina, cargar]);

  return (
    <>
      <Button size="small" icon={<HistoryOutlined />} onClick={() => setAbierto(true)}>
        Ejecuciones
      </Button>
      <Drawer open={abierto} onClose={() => setAbierto(false)} title={`Ejecuciones – ${titulo}`} width={900} destroyOnHidden>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Table<Ejecucion>
          size="small"
          rowKey="id"
          loading={cargando}
          dataSource={datos?.results ?? []}
          locale={{ emptyText: "Todavía no hay ejecuciones registradas" }}
          pagination={{
            current: pagina,
            pageSize: 20,
            total: datos?.count ?? 0,
            onChange: setPagina,
            showSizeChanger: false,
          }}
          expandable={{ expandedRowRender: (e) => <Detalle detalle={e.detalle} />, rowExpandable: (e) => !!e.detalle }}
          columns={[
            { title: "Inicio", dataIndex: "inicio", render: (v: string | null) => formatFechaApi(v) || "-" },
            { title: "Duración", dataIndex: "duracionMs", render: duracion },
            {
              title: "Resultado",
              dataIndex: "ok",
              render: (ok: boolean) => <Tag color={ok ? "green" : "red"}>{ok ? "OK" : "Error"}</Tag>,
            },
            { title: "Origen", dataIndex: "origen", render: (v: string | null) => v ?? "-" },
            { title: "Resumen", dataIndex: "resumen", render: (v: string | null) => v ?? "-" },
          ]}
        />
      </Drawer>
    </>
  );
}
