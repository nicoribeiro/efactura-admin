import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Table, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { ordenar } from "../../utils/orden";

interface CarpetaImap {
  folderName: string;
  uidValidity: number;
  lastUid: number;
  ultimaSincronizacion?: string | null; // "yyyy-MM-dd HH:mm:ss z"
}

/** Se recarga sola cada minuto mientras la pestaña esta abierta */
const RECARGA_MS = 60_000;

/** El poller de emails corre cada 5 minutos */
const MINUTOS_AL_DIA = 15;
const HORAS_ATRASADA = 24;

/** Se toma la fecha sin la zona (servidor y usuarios en Uruguay) */
const fecha = (valor?: string | null) => (valor ? dayjs(valor.slice(0, 19)) : undefined);

/** Estado de la carpeta: texto y color */
function estadoCarpeta(carpeta: CarpetaImap): { label: string; color?: string } {
  const ultima = fecha(carpeta.ultimaSincronizacion);
  if (!ultima) return { label: "Sin datos" };
  const minutos = dayjs().diff(ultima, "minute");
  if (minutos <= MINUTOS_AL_DIA) return { label: "Al día", color: "green" };
  if (minutos <= HORAS_ATRASADA * 60) return { label: "Atrasada", color: "orange" };
  return { label: "Sin sincronizar", color: "red" };
}

function estado(carpeta: CarpetaImap) {
  const { label, color } = estadoCarpeta(carpeta);
  return <Tag color={color}>{label}</Tag>;
}

function hace(valor?: string | null) {
  const ultima = fecha(valor);
  if (!ultima) return "";
  const minutos = dayjs().diff(ultima, "minute");
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

/** Estado de la sincronización IMAP de cada carpeta del buzón de la empresa (solo lectura) */
export function CarpetasImap({ rut }: { rut: string }) {
  const [carpetas, setCarpetas] = useState<CarpetaImap[]>([]);
  const [error, setError] = useState<{ message?: string; statusCode?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    apiJson<CarpetaImap[]>("GET", `/empresa/${rut}/emails/carpetas`)
      .then((data) => {
        if (cancelado) return;
        setCarpetas(data ?? []);
        setError(null);
        setActualizado(new Date());
      })
      .catch((e) => !cancelado && setError(e))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [rut, recarga]);

  useEffect(() => {
    const timer = setInterval(() => setRecarga((n) => n + 1), RECARGA_MS);
    return () => clearInterval(timer);
  }, []);

  const conProblemas = carpetas.filter((c) => {
    const ultima = fecha(c.ultimaSincronizacion);
    return !ultima || dayjs().diff(ultima, "minute") > MINUTOS_AL_DIA;
  }).length;

  // Pestaña propia en la empresa (entre Emails recibidos y Usuarios): arriba, las que no se sincronizan hace rato
  const aviso =
    conProblemas > 0 ? (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={`${conProblemas} carpeta${conProblemas === 1 ? "" : "s"} sin sincronizar recientemente`}
      />
    ) : null;

  let contenido;
  if (error)
    contenido = (
      <Alert
        type="error"
        showIcon
        message="No se pudo obtener el estado de las carpetas"
        description={
          error.statusCode === 404
            ? "La API no tiene el endpoint GET /empresa/:rut/emails/carpetas (requiere una versión más nueva de java_efactura_uy)."
            : error.message
        }
      />
    );
  else
    contenido = (
      <>
        <Table<CarpetaImap>
          dataSource={carpetas}
          loading={loading && carpetas.length === 0}
          rowKey="folderName"
          size="small"
          pagination={false}
          locale={{ emptyText: "Todavía no se sincronizó ninguna carpeta" }}
        >
          <Table.Column<CarpetaImap>
            title="Carpeta"
            dataIndex="folderName"
            sorter={ordenar<CarpetaImap>((c) => c.folderName)}
          />
          <Table.Column<CarpetaImap>
            title="Último UID procesado"
            dataIndex="lastUid"
            align="right"
            sorter={ordenar<CarpetaImap>((c) => c.lastUid)}
          />
          <Table.Column<CarpetaImap>
            title="Última sincronización"
            dataIndex="ultimaSincronizacion"
            sorter={ordenar<CarpetaImap>((c) => c.ultimaSincronizacion)}
            render={(valor?: string | null) =>
              valor ? (
                <Tooltip title={valor}>
                  {valor.slice(0, 19)} <Typography.Text type="secondary">({hace(valor)})</Typography.Text>
                </Tooltip>
              ) : (
                "-"
              )
            }
          />
          <Table.Column<CarpetaImap>
            title="Estado"
            render={(_, carpeta) => estado(carpeta)}
            sorter={ordenar<CarpetaImap>((c) => estadoCarpeta(c).label)}
          />
        </Table>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => setRecarga((n) => n + 1)} style={{ marginRight: 8 }}>
            Actualizar
          </Button>
          {actualizado && `Consultado ${dayjs(actualizado).format("HH:mm:ss")} (se actualiza cada minuto). `}
          Se revisan cada 5 minutos todas las carpetas salvo papelera, spam, enviados y borradores (y las excluidas en
          mail.recepcion.carpetasExcluidas).
        </Typography.Paragraph>
      </>
    );

  return (
    <>
      {aviso}
      {contenido}
    </>
  );
}
