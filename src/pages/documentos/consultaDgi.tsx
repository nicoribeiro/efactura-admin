import { CloudSyncOutlined } from "@ant-design/icons";
import { App, Button, Space, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { ESTADOS_CFE } from "../../constants/cfe";
import { rolUsuario } from "../../providers/authProvider";
import type { DocumentoRef } from "./useSobre";

/** GET /documentos/resultado: el comprobante, con lo que paso con la consulta */
interface ResultadoConsulta {
  estado?: string | null;
  consultaDgi?:
    | "YA_TENIA_RESPUESTA"
    | "SIN_SOBRE"
    | "ANTES_DE_TIEMPO"
    | "RESPONDIO"
    | "SIN_RESPUESTA";
  /** yyyy-MM-ddTHH:mm:ss-03:00 */
  respuestaDisponibleDesde?: string;
  result_code?: number;
  result_message?: string;
  result_detail?: string;
}

/** "yyyy-MM-dd HH:mm:ss UYT" (fechaConsulta del sobre, hora de Uruguay como el panel) */
const fechaSobre = (valor?: string | null) =>
  valor ? dayjs(valor.slice(0, 19)) : undefined;

const faltan = (hasta: Dayjs, ahora: Dayjs) => {
  const s = Math.max(0, hasta.diff(ahora, "second"));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
};

/**
 * Consulta a DGI el resultado de un comprobante emitido que todavia no tiene respuesta. DGI indica al recibir el sobre
 * desde cuando tiene la respuesta (fechaConsulta): hasta esa hora el boton queda deshabilitado con la cuenta regresiva.
 * Solo ADMIN.
 */
export function ConsultaDgi({
  rut,
  documento,
  fechaConsulta,
  onRespuesta,
}: {
  rut: string;
  documento: DocumentoRef;
  /** fechaConsulta del sobre */
  fechaConsulta?: string | null;
  /** DGI respondio: recargar el comprobante y su sobre */
  onRespuesta: () => void;
}) {
  const { message } = App.useApp();
  const [esAdmin, setEsAdmin] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [ahora, setAhora] = useState(dayjs());
  // La hora que devuelve la API al consultar antes de tiempo reemplaza a la del sobre
  const [disponibleDesde, setDisponibleDesde] = useState<Dayjs>();
  const [sinRespuesta, setSinRespuesta] = useState<Dayjs>();

  useEffect(() => {
    rolUsuario().then((r) => setEsAdmin(r === "ADMIN"));
  }, []);

  const desde = disponibleDesde ?? fechaSobre(fechaConsulta);
  const esperando = !!desde && desde.isAfter(ahora);

  // Cuenta regresiva mientras falte para la hora de DGI
  useEffect(() => {
    if (!esperando) return;
    const timer = setInterval(() => setAhora(dayjs()), 1000);
    return () => clearInterval(timer);
  }, [esperando]);

  if (!esAdmin) return null;

  const consultar = async () => {
    setConsultando(true);
    try {
      const r = await apiJson<ResultadoConsulta>(
        "GET",
        `/empresa/${rut}/documentos/resultado`,
        { ...documento },
      );
      switch (r.consultaDgi) {
        case "RESPONDIO":
        case "YA_TENIA_RESPUESTA":
          message.success(
            `DGI respondió: ${ESTADOS_CFE[r.estado ?? ""]?.label ?? r.estado}`,
          );
          onRespuesta();
          break;
        case "ANTES_DE_TIEMPO":
          if (r.respuestaDisponibleDesde)
            setDisponibleDesde(dayjs(r.respuestaDisponibleDesde));
          setAhora(dayjs());
          message.info("DGI todavía no tiene la respuesta");
          break;
        case "SIN_SOBRE":
          message.warning("El CFE no tiene sobre enviado a DGI");
          break;
        default:
          setSinRespuesta(dayjs());
          message.warning(
            r.result_code
              ? [r.result_message, r.result_detail].filter(Boolean).join(": ")
              : "DGI todavía no tiene la respuesta, probá en unos minutos",
          );
      }
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setConsultando(false);
    }
  };

  return (
    <Space size={8} wrap>
      <Button
        size="small"
        icon={<CloudSyncOutlined />}
        disabled={esperando}
        loading={consultando}
        onClick={consultar}
      >
        Consultar a DGI
      </Button>
      {esperando && desde ? (
        <Typography.Text type="secondary">
          DGI tendrá la respuesta a las {desde.format("HH:mm:ss")} (faltan{" "}
          {faltan(desde, ahora)})
        </Typography.Text>
      ) : (
        sinRespuesta && (
          <Typography.Text type="secondary">
            Sin respuesta a las {sinRespuesta.format("HH:mm:ss")}
          </Typography.Text>
        )
      )}
    </Space>
  );
}
