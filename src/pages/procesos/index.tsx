import { ReloadOutlined } from "@ant-design/icons";
import { List } from "@refinedev/antd";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";

dayjs.extend(relativeTime);

interface Proceso {
  nombre: string;
  activo: boolean;
  intervaloSegundos: number;
  programacion?: string | null;
  ultimoInicio?: string | null;
  ultimoFin?: string | null;
  ultimaDuracionMs?: number | null;
  enEjecucion: boolean;
  ejecuciones: number;
  errores: number;
  ultimoError?: string | null;
  ultimoErrorFecha?: string | null;
  resumen?: string | null;
  resumenFecha?: string | null;
}

interface Respuesta {
  inicioInstancia: string;
  ahora: string;
  procesos: Proceso[];
}

/** Lo que hace cada poller (por nombre de clase en la API) y su clave de activación en application.conf */
const INFO: Record<
  string,
  {
    titulo: string;
    descripcion: string;
    config: string;
    link?: { to: string; texto: string };
  }
> = {
  ReporteDiarioPoller: {
    titulo: "Reporte diario a DGI",
    descripcion:
      "Genera los reportes diarios faltantes (no aceptados) de hace 30 a hace 11 días, para las empresas con firma digital.",
    config: "ReporteDiarioPoller.run",
    link: { to: "/reportes", texto: "Ver reportes" },
  },
  EmailEntrantesPoller: {
    titulo: "Emails recibidos",
    descripcion:
      "Lee las carpetas IMAP de las empresas y procesa los CFE que llegan por email.",
    config: "EmailEntrantesPoller.run",
  },
  PollerTipoDeCambioRunner: {
    titulo: "Cotizaciones (INE)",
    descripcion:
      "Descarga la cotización del dólar de INE y completa los días que faltan.",
    config: "TipoDeCambioPoller.run",
    link: { to: "/cotizaciones", texto: "Ver cotizaciones" },
  },
  NotificationPoller: {
    titulo: "Notificaciones",
    descripcion: "Envía las notificaciones pendientes a los usuarios.",
    config: "NotificationPoller.run",
  },
};

const fecha = (v?: string | null) => (v ? dayjs(v.slice(0, 19)) : undefined);

const intervalo = (segundos: number) =>
  segundos >= 86400
    ? `cada ${Math.round(segundos / 86400)} día(s)`
    : segundos >= 3600
      ? `cada ${Math.round(segundos / 3600)} hora(s)`
      : segundos >= 60
        ? `cada ${Math.round(segundos / 60)} minuto(s)`
        : `cada ${segundos} segundos`;

const duracion = (ms?: number | null) =>
  ms == null
    ? ""
    : ms < 1000
      ? `${ms} ms`
      : ms < 60000
        ? `${(ms / 1000).toFixed(1)} s`
        : `${(ms / 60000).toFixed(1)} min`;

/**
 * Diferencia entre el reloj del navegador y el del servidor (ms), para que los tiempos relativos no queden "en el
 * futuro" cuando el servidor va adelantado. Se actualiza con cada respuesta.
 */
let desfaseServidor = 0;

/** Cuándo, en relativo (según el reloj del servidor), con la fecha exacta al pasar el mouse */
const Cuando = ({ valor }: { valor?: string | null }) => {
  const f = fecha(valor);
  return f ? (
    <Tooltip title={formatFechaApi(valor)}>
      <span>{f.add(desfaseServidor, "millisecond").fromNow()}</span>
    </Tooltip>
  ) : (
    <Typography.Text type="secondary">Todavía no</Typography.Text>
  );
};

/** Procesos automáticos de la API (pollers): estado en memoria de la instancia, se actualiza cada 30 segundos */
export function Procesos() {
  const [datos, setDatos] = useState<Respuesta>();
  const [error, setError] = useState<{
    message?: string;
    statusCode?: number;
  }>();
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    apiJson<Respuesta>("GET", "/procesos")
      .then((r) => {
        desfaseServidor =
          Date.now() - (fecha(r.ahora)?.valueOf() ?? Date.now());
        setDatos(r);
        setError(undefined);
      })
      .catch(setError)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 30_000);
    return () => clearInterval(timer);
  }, [cargar]);

  if (error && !datos)
    return (
      <List title="Procesos automáticos">
        <Alert
          type="error"
          showIcon
          message="No se pudo obtener el estado de los procesos"
          description={
            error.statusCode === 404
              ? "La API no tiene el endpoint GET /procesos (requiere una versión más nueva de java_efactura_uy)."
              : error.statusCode === 403
                ? "Solo los administradores pueden ver los procesos."
                : error.message
          }
        />
      </List>
    );

  return (
    <List
      title="Procesos automáticos"
      headerButtons={
        <Button icon={<ReloadOutlined />} loading={cargando} onClick={cargar}>
          Actualizar
        </Button>
      }
    >
      {!datos ? (
        <Skeleton active />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            Instancia de la API iniciada{" "}
            <Cuando valor={datos.inicioInstancia} />. Los contadores y
            resultados son desde ese momento (se reinician con cada deploy).
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            {datos.procesos.map((p) => {
              const info = INFO[p.nombre];
              const conError =
                p.ultimoErrorFecha &&
                (!p.ultimoFin ||
                  fecha(p.ultimoErrorFecha)!.isSame(fecha(p.ultimoFin)));
              return (
                <Col xs={24} xl={12} key={p.nombre}>
                  <Card
                    size="small"
                    style={{ height: "100%" }}
                    title={
                      <Space>
                        {info?.titulo ?? p.nombre}
                        {p.activo ? (
                          <Tag color="green">Activo</Tag>
                        ) : (
                          <Tag>Desactivado</Tag>
                        )}
                        {p.enEjecucion && (
                          <Tag color="processing">Ejecutando</Tag>
                        )}
                        {conError && (
                          <Tag color="red">Falló la última ejecución</Tag>
                        )}
                      </Space>
                    }
                    extra={
                      info?.link && (
                        <Link to={info.link.to}>{info.link.texto}</Link>
                      )
                    }
                  >
                    {info && (
                      <Typography.Paragraph
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {info.descripcion}
                      </Typography.Paragraph>
                    )}
                    {!p.activo ? (
                      <Typography.Text type="secondary">
                        No corre en esta instancia (
                        {info?.config ?? `${p.nombre}.run`} = false en
                        application.conf).
                      </Typography.Text>
                    ) : (
                      <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="Cuándo corre">
                          {p.programacion ?? intervalo(p.intervaloSegundos)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Última ejecución">
                          <Cuando valor={p.ultimoFin ?? p.ultimoInicio} />
                          {p.ultimaDuracionMs != null && (
                            <Typography.Text type="secondary">
                              {" "}
                              · {duracion(p.ultimaDuracionMs)}
                            </Typography.Text>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Ejecuciones">
                          {p.ejecuciones}
                          {p.errores > 0 && (
                            <Typography.Text type="danger">
                              {" "}
                              · {p.errores} con error
                            </Typography.Text>
                          )}
                        </Descriptions.Item>
                        {p.resumen && (
                          <Descriptions.Item label="Último resultado">
                            <div>{p.resumen}</div>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                            >
                              <Cuando valor={p.resumenFecha} />
                            </Typography.Text>
                          </Descriptions.Item>
                        )}
                        {p.ultimoError && (
                          <Descriptions.Item label="Último error">
                            <Typography.Text
                              type="danger"
                              style={{ wordBreak: "break-word" }}
                            >
                              {p.ultimoError}
                            </Typography.Text>
                            <div>
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                              >
                                <Cuando valor={p.ultimoErrorFecha} />
                              </Typography.Text>
                            </div>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        </>
      )}
    </List>
  );
}
