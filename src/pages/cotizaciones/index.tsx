import { List } from "@refinedev/antd";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/http";
import { ordenar } from "../../utils/orden";
import { GraficoCotizacion } from "./grafico";

interface Cotizacion {
  fecha: string;
  compra?: number | null;
  venta?: number | null;
  interbancario?: number | null;
}

interface RespuestaCotizaciones {
  moneda: string;
  desde: string;
  hasta: string;
  cotizaciones: Cotizacion[];
}

interface ValorUI {
  anio: number;
  cotizacion: number;
}

/** Fila por dia del periodo (los dias sin cotizacion tambien, para verlos) */
interface FilaDia extends Partial<Cotizacion> {
  fecha: string;
  falta: boolean;
}

type Rango = [Dayjs, Dayjs];

const RANGOS: { label: string; dias: number }[] = [
  { label: "Últimos 30 días", dias: 30 },
  { label: "Últimos 90 días", dias: 90 },
  { label: "Último año", dias: 365 },
];
/** Los periodos terminan ayer: la cotizacion de un dia se carga al dia siguiente */
const rangoUltimos = (dias: number): Rango => {
  const ayer = dayjs().startOf("day").subtract(1, "day");
  return [ayer.subtract(dias - 1, "day"), ayer];
};

/** Hoy todavia no tiene cotizacion (el poller la carga al dia siguiente): no cuenta como faltante */
const esHoy = (fecha: string) => dayjs(fecha).isSame(dayjs(), "day");

const numero = (v?: number | null, decimales = 3) =>
  v == null
    ? "-"
    : v.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimales,
      });

const esFinDeSemana = (fecha: string) => [0, 6].includes(dayjs(fecha).day());

/** Estado del dia como se ve en la tabla (para ordenar por esa columna) */
const estadoDia = (f: FilaDia) =>
  !f.falta
    ? null
    : esHoy(f.fecha)
      ? "Pendiente"
      : esFinDeSemana(f.fecha)
        ? "Sin cotización (fin de semana)"
        : "Sin cotización";

/**
 * Cotizaciones de INE que guarda la API y Unidad Indexada por año (solo lectura). Arriba, si están los valores que
 * necesita la emisión de hoy: los eTickets en moneda extranjera usan la venta del día anterior y la UI del año.
 */
export function Cotizaciones() {
  const [rango, setRango] = useState<Rango>(rangoUltimos(30));
  const [datos, setDatos] = useState<RespuestaCotizaciones>();
  const [ayer, setAyer] = useState<Cotizacion | null>();
  const [uis, setUis] = useState<ValorUI[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const [desde, hasta] = rango;
  const { token } = theme.useToken();

  // Cotizacion de ayer y valores de UI: no dependen del periodo elegido
  useEffect(() => {
    const fecha = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    apiJson<RespuestaCotizaciones>("GET", "/tiposDeCambio", {
      moneda: "USD",
      desde: fecha,
      hasta: fecha,
    })
      .then((r) => setAyer(r.cotizaciones[0] ?? null))
      .catch(() => setAyer(undefined));
    apiJson<ValorUI[]>("GET", "/ui")
      .then(setUis)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    apiJson<RespuestaCotizaciones>("GET", "/tiposDeCambio", {
      moneda: "USD",
      desde: desde.format("YYYY-MM-DD"),
      hasta: hasta.format("YYYY-MM-DD"),
    })
      .then((r) => {
        if (cancelado) return;
        setDatos(r);
        setError(undefined);
      })
      .catch((e: { message?: string; statusCode?: number }) => {
        if (cancelado) return;
        setError(
          e.statusCode === 404
            ? "La API no tiene el endpoint GET /tiposDeCambio (requiere una versión más nueva de java_efactura_uy)."
            : e.message,
        );
      })
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  // Todos los dias del periodo, del mas nuevo al mas viejo, marcando los que no tienen cotizacion
  const filas = useMemo<FilaDia[]>(() => {
    const porFecha = new Map(
      (datos?.cotizaciones ?? []).map((c) => [c.fecha, c]),
    );
    const resultado: FilaDia[] = [];
    for (let d = hasta; !d.isBefore(desde, "day"); d = d.subtract(1, "day")) {
      const fecha = d.format("YYYY-MM-DD");
      const c = porFecha.get(fecha);
      resultado.push(c ? { ...c, falta: false } : { fecha, falta: true });
    }
    return resultado;
  }, [datos, desde, hasta]);

  const faltantes = filas.filter((f) => f.falta && !esHoy(f.fecha));
  const faltantesHabiles = faltantes.filter((f) => !esFinDeSemana(f.fecha));
  const anio = dayjs().year();
  const uiAnio = uis?.find((u) => u.anio === anio);
  const fechaAyer = dayjs().subtract(1, "day");

  return (
    <List title="Cotizaciones y UI">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Para emitir hoy" style={{ height: "100%" }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Los eTickets en moneda extranjera se controlan contra el tope de
              5000 UI con la venta del dólar del día anterior y la UI del año:
              si falta alguno, la emisión falla.
            </Typography.Paragraph>
            <Row gutter={16}>
              <Col span={12}>
                {ayer === undefined && !uis ? (
                  <Skeleton active paragraph={false} />
                ) : (
                  <Statistic
                    decimalSeparator=","
                    groupSeparator="."
                    title={`Venta USD del ${fechaAyer.format("DD/MM")} (${fechaAyer.format("ddd")})`}
                    value={ayer?.venta ?? "Sin cotización"}
                    precision={ayer?.venta != null ? 3 : undefined}
                    valueStyle={{
                      color: ayer?.venta == null ? token.colorError : undefined,
                      fontSize: 20,
                    }}
                  />
                )}
              </Col>
              <Col span={12}>
                {!uis ? (
                  <Skeleton active paragraph={false} />
                ) : (
                  <Statistic
                    decimalSeparator=","
                    groupSeparator="."
                    title={`UI ${anio}`}
                    value={uiAnio?.cotizacion ?? "No cargada"}
                    precision={uiAnio ? 4 : undefined}
                    valueStyle={{
                      color: uiAnio ? undefined : token.colorError,
                      fontSize: 20,
                    }}
                  />
                )}
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="Unidad Indexada por año"
            style={{ height: "100%" }}
          >
            {uis && !uiAnio && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 8 }}
                message={`Falta la UI de ${anio}: los eTickets en moneda extranjera fallan (UI_NO_ENCONTRADA).`}
              />
            )}
            <Table<ValorUI>
              dataSource={uis ?? []}
              rowKey="anio"
              size="small"
              loading={!uis && !error}
              pagination={{
                pageSize: 5,
                size: "small",
                hideOnSinglePage: true,
              }}
            >
              <Table.Column<ValorUI>
                title="Año"
                dataIndex="anio"
                sorter={ordenar<ValorUI>((u) => u.anio)}
              />
              <Table.Column<ValorUI>
                title="Valor (UYU)"
                dataIndex="cotizacion"
                align="right"
                sorter={ordenar<ValorUI>((u) => u.cotizacion)}
                render={(v: number) => numero(v, 4)}
              />
            </Table>
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            size="small"
            title="Dólar (USD) – INE"
            extra={
              <Space wrap>
                <DatePicker.RangePicker
                  format="DD/MM/YYYY"
                  allowClear={false}
                  value={rango}
                  disabledDate={(d) => d.isAfter(dayjs(), "day")}
                  onChange={(v) =>
                    v?.[0] && v?.[1] && setRango([v[0] as Dayjs, v[1] as Dayjs])
                  }
                />
                {RANGOS.map((r) => {
                  const valor = rangoUltimos(r.dias);
                  const activo =
                    valor[0].isSame(desde, "day") &&
                    valor[1].isSame(hasta, "day");
                  return (
                    <Button
                      key={r.label}
                      size="small"
                      type={activo ? "primary" : "default"}
                      onClick={() => setRango(valor)}
                    >
                      {r.label}
                    </Button>
                  );
                })}
              </Space>
            }
          >
            {error ? (
              <Alert
                type="error"
                showIcon
                message="No se pudieron obtener las cotizaciones"
                description={error}
              />
            ) : loading && !datos ? (
              <Skeleton active />
            ) : (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {faltantes.length > 0 && (
                  <Alert
                    type={faltantesHabiles.length > 0 ? "warning" : "info"}
                    showIcon
                    message={`${faltantes.length} día${faltantes.length === 1 ? "" : "s"} sin cotización en el período (${faltantesHabiles.length} hábil${faltantesHabiles.length === 1 ? "" : "es"})`}
                    description="Un eTicket en USD emitido el día siguiente a un día sin cotización falla al controlar el tope de UI. INE publica también fines de semana y feriados (repite el último valor), así que un día faltante suele indicar que el poller no corrió."
                  />
                )}
                <GraficoCotizacion
                  etiqueta="Venta"
                  dias={[...filas]
                    .reverse()
                    .map((f) => ({ fecha: f.fecha, valor: f.venta }))}
                />
                <Table<FilaDia>
                  dataSource={filas}
                  rowKey="fecha"
                  size="small"
                  pagination={{ pageSize: 15, size: "small" }}
                  scroll={{ x: true }}
                >
                  <Table.Column<FilaDia>
                    title="Fecha"
                    sorter={ordenar<FilaDia>((f) => f.fecha)}
                    render={(_, f) => (
                      <span style={{ whiteSpace: "nowrap" }}>
                        {dayjs(f.fecha).format("ddd DD/MM/YYYY")}
                      </span>
                    )}
                  />
                  <Table.Column<FilaDia>
                    title="Compra"
                    align="right"
                    sorter={ordenar<FilaDia>((f) => f.compra)}
                    render={(_, f) => (f.falta ? "" : numero(f.compra))}
                  />
                  <Table.Column<FilaDia>
                    title="Venta"
                    align="right"
                    sorter={ordenar<FilaDia>((f) => f.venta)}
                    render={(_, f) => (f.falta ? "" : numero(f.venta))}
                  />
                  <Table.Column<FilaDia>
                    title="Interbancario"
                    align="right"
                    sorter={ordenar<FilaDia>((f) => f.interbancario)}
                    render={(_, f) => (f.falta ? "" : numero(f.interbancario))}
                  />
                  <Table.Column<FilaDia>
                    title=""
                    sorter={ordenar<FilaDia>((f) => estadoDia(f))}
                    render={(_, f) =>
                      f.falta && esHoy(f.fecha) ? (
                        <Tag>Pendiente (se carga mañana)</Tag>
                      ) : f.falta ? (
                        <Tag
                          color={esFinDeSemana(f.fecha) ? "default" : "orange"}
                        >
                          Sin cotización
                          {esFinDeSemana(f.fecha) ? " (fin de semana)" : ""}
                        </Tag>
                      ) : null
                    }
                  />
                </Table>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </List>
  );
}
