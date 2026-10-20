import { List } from "@refinedev/antd";
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/http";
import { XmlCode } from "../../components/XmlCode";
import { useEmpresa } from "../../contexts/empresa";
import { rolUsuario } from "../../providers/authProvider";
import { mismoRango, rangoPorDefecto, rangosRapidos } from "../../utils/rangos";
import { ordenar } from "../../utils/orden";
import { parsearReporte } from "../../utils/reporte";
import { ReporteDetalle } from "./detalle";
import { tagEstadoReporte } from "./estado";
import { GenerarReportes } from "./generar";

/** ReporteDiarioSerializer */
interface ReporteDiario {
  id: number;
  fecha: string; // yyyy-MM-dd
  secuencial: number;
  timestampEnviado: string; // yyyy-MM-dd HH:mm:ss o ""
  estado: string; // AR, BR, BA o ""
  idReceptor?: string | null;
  xml?: string | null;
  respuesta?: string | null;
}

interface Fila {
  key: string;
  fecha: string;
  reporte?: ReporteDiario;
  /** Primera fila del dia (la del reporte mas reciente) */
  primera: boolean;
}

const MAX_DIAS = 62;

/** La API no genera el reporte de un dia hasta 43 horas despues de su comienzo (en produccion) */
const HORAS_MINIMAS = 43;

/** Ya se puede generar el reporte del dia (yyyy-MM-dd) */
const generable = (fecha: string) =>
  dayjs().diff(dayjs(fecha), "hour") > HORAS_MINIMAS;

/** Cantidad de comprobantes informados (carátula del XML del reporte) */
const cantidadComprobantes = (reporte: ReporteDiario) =>
  parsearReporte(reporte.xml)?.caratula.CantComprobantes ?? "-";

/**
 * El dia ya esta aceptado por DGI: como en la API, cuenta el reporte mas reciente con respuesta (o el mas reciente si
 * ninguno tiene)
 */
const aceptado = (delDia: ReporteDiario[]) => {
  const ultimo = delDia.find((r) => r.estado) ?? delDia[0];
  return ultimo?.estado === "AR";
};

/** Reportes diarios enviados a DGI por la empresa seleccionada; un ADMIN puede generar los que faltan */
export function ReporteDiarioList() {
  const { empresa } = useEmpresa();
  // Por defecto los ultimos 30 dias
  const [rango, setRango] = useState<[Dayjs, Dayjs]>(rangoPorDefecto);
  const [reportes, setReportes] = useState<ReporteDiario[]>([]);
  const [error, setError] = useState<{ message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [esAdmin, setEsAdmin] = useState(false);
  const [aGenerar, setAGenerar] = useState<{
    fechas: string[];
    soloFaltantes: boolean;
    /** Secuencial del reporte que reemplaza al aceptado (al regenerar un dia aceptado) */
    reemplaza?: number;
  }>();

  useEffect(() => {
    rolUsuario().then((r) => setEsAdmin(r === "ADMIN"));
  }, []);

  const [desde, hasta] = rango;
  const dias = hasta.startOf("day").diff(desde.startOf("day"), "day") + 1;

  useEffect(() => {
    if (!empresa) return;
    let cancelado = false;
    setLoading(true);
    setError(null);
    // La API devuelve un array por dia con reportes (los dias sin reporte no aparecen)
    apiJson<ReporteDiario[][]>(
      "GET",
      `/empresa/${empresa.rut}/reporteDiario/${desde.format("YYYYMMDD")}`,
      {
        cantReportes: dias,
      },
    )
      .then((porDia) => !cancelado && setReportes((porDia ?? []).flat()))
      .catch((e) => !cancelado && setError(e))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [empresa, desde, dias, recarga]);

  // Una fila por dia (del mas nuevo al mas viejo); los dias sin reporte quedan visibles como "Sin reporte"
  const { filas, faltantes, reemplazos } = useMemo(() => {
    const resultado: Fila[] = [];
    // Dias sin reporte aceptado que ya se pueden generar, del mas viejo al mas nuevo
    const faltantes: string[] = [];
    // Dias aceptados: secuencial del reporte que se enviaria al regenerarlos
    const reemplazos: Record<string, number> = {};
    for (
      let d = hasta.startOf("day");
      !d.isBefore(desde.startOf("day"));
      d = d.subtract(1, "day")
    ) {
      if (d.isAfter(dayjs(), "day")) continue;
      const fecha = d.format("YYYY-MM-DD");
      const delDia = reportes
        .filter((r) => r.fecha === fecha)
        .sort((a, b) => b.secuencial - a.secuencial);
      if (!aceptado(delDia) && generable(fecha)) faltantes.unshift(fecha);
      // Como la API: el nuevo secuencial es el mayor aceptado + 1
      if (aceptado(delDia))
        reemplazos[fecha] =
          Math.max(
            ...delDia.filter((r) => r.estado === "AR").map((r) => r.secuencial),
          ) + 1;
      if (delDia.length === 0)
        resultado.push({ key: fecha, fecha, primera: true });
      else
        delDia.forEach((reporte, i) =>
          resultado.push({
            key: `${fecha}-${reporte.id}`,
            fecha,
            reporte,
            primera: i === 0,
          }),
        );
    }
    return { filas: resultado, faltantes, reemplazos };
  }, [reportes, desde, hasta]);

  if (!empresa)
    return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  return (
    <List title={`Reporte diario - ${empresa.razon ?? empresa.rut}`}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Text>Período</Typography.Text>
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          allowClear={false}
          value={rango}
          presets={rangosRapidos()}
          disabledDate={(d) => d.isAfter(dayjs(), "day")}
          onChange={(valores) => {
            if (!valores?.[0] || !valores?.[1]) return;
            const [inicio, fin] = valores as [Dayjs, Dayjs];
            // Limite para no pedir demasiados dias de una vez
            setRango(
              fin.diff(inicio, "day") >= MAX_DIAS
                ? [fin.subtract(MAX_DIAS - 1, "day"), fin]
                : [inicio, fin],
            );
          }}
        />
        <Typography.Text type="secondary">
          Hasta {MAX_DIAS} días.
        </Typography.Text>
        {esAdmin && (
          <Button
            disabled={loading || !!error || faltantes.length === 0}
            onClick={() =>
              setAGenerar({ fechas: faltantes, soloFaltantes: true })
            }
          >
            Generar faltantes ({faltantes.length})
          </Button>
        )}
      </Space>
      <Space style={{ marginBottom: 16, display: "flex" }} wrap size={[8, 8]}>
        {rangosRapidos().map(({ label, value }) => (
          <Button
            key={label}
            size="small"
            type={mismoRango(rango, value) ? "primary" : "default"}
            onClick={() => setRango(value)}
          >
            {label}
          </Button>
        ))}
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="No se pudieron obtener los reportes"
          description={error.message}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<Fila>
        dataSource={filas}
        loading={loading}
        rowKey="key"
        size="middle"
        pagination={false}
        expandable={{
          rowExpandable: (fila) =>
            !!(fila.reporte?.xml || fila.reporte?.respuesta),
          expandedRowRender: (fila) => (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <ReporteDetalle
                xml={fila.reporte?.xml}
                respuesta={fila.reporte?.respuesta}
              />
              <Collapse
                size="small"
                items={[
                  {
                    key: "xml",
                    label: "Reporte enviado a DGI",
                    contenido: fila.reporte?.xml,
                  },
                  {
                    key: "respuesta",
                    label: "Respuesta de DGI",
                    contenido: fila.reporte?.respuesta,
                  },
                ]
                  .filter((x) => x.contenido)
                  .map((x) => ({
                    key: x.key,
                    label: x.label,
                    children: <XmlCode xml={x.contenido ?? ""} />,
                  }))}
              />
            </Space>
          ),
        }}
        locale={{ emptyText: <Empty description="Sin datos" /> }}
      >
        <Table.Column<Fila>
          title="Fecha"
          dataIndex="fecha"
          sorter={ordenar<Fila>((fila) => fila.fecha)}
          render={(fecha: string) => dayjs(fecha).format("DD/MM/YYYY ddd")}
        />
        <Table.Column<Fila>
          title="Secuencial"
          sorter={ordenar<Fila>((fila) => fila.reporte?.secuencial)}
          render={(_, fila) => fila.reporte?.secuencial ?? "-"}
        />
        <Table.Column<Fila>
          title="CFE"
          align="right"
          sorter={ordenar<Fila>((fila) => {
            const n = fila.reporte ? Number(cantidadComprobantes(fila.reporte)) : NaN;
            return Number.isNaN(n) ? null : n;
          })}
          render={(_, fila) =>
            fila.reporte ? cantidadComprobantes(fila.reporte) : "-"
          }
        />
        <Table.Column<Fila>
          title="Enviado"
          sorter={ordenar<Fila>((fila) => fila.reporte?.timestampEnviado)}
          render={(_, fila) => fila.reporte?.timestampEnviado || "-"}
        />
        <Table.Column<Fila>
          title="Id DGI"
          sorter={ordenar<Fila>((fila) => fila.reporte?.idReceptor)}
          render={(_, fila) => fila.reporte?.idReceptor || "-"}
        />
        <Table.Column<Fila>
          title="Estado"
          sorter={ordenar<Fila>((fila) =>
            fila.reporte ? fila.reporte.estado || "Sin respuesta" : null,
          )}
          render={(_, fila) =>
            fila.reporte ? (
              tagEstadoReporte(fila.reporte.estado)
            ) : (
              <Tag>Sin reporte</Tag>
            )
          }
        />
        {esAdmin && (
          <Table.Column<Fila>
            title="Acción"
            render={(_, fila) =>
              fila.primera && generable(fila.fecha) ? (
                <Button
                  size="small"
                  variant="solid"
                  color={fila.reporte ? "orange" : "primary"}
                  onClick={() =>
                    setAGenerar({
                      fechas: [fila.fecha],
                      soloFaltantes: false,
                      reemplaza: reemplazos[fila.fecha],
                    })
                  }
                >
                  {fila.reporte ? "Regenerar" : "Generar"}
                </Button>
              ) : null
            }
          />
        )}
      </Table>
      {aGenerar && (
        <GenerarReportes
          rut={empresa.rut}
          fechas={aGenerar.fechas}
          soloFaltantes={aGenerar.soloFaltantes}
          reemplaza={aGenerar.reemplaza}
          onCerrar={() => setAGenerar(undefined)}
          onTerminado={() => setRecarga((n) => n + 1)}
        />
      )}
    </List>
  );
}
