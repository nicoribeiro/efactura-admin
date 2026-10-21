import { Alert, Button, Modal, Space, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { apiJson } from "../../api/http";
import { ordenar } from "../../utils/orden";
import { tagEstadoReporte } from "./estado";

/** El proceso automatico reporta con este atraso a proposito (ReporteDiarioPoller, de hace 30 a hace 11 dias) */
const DIAS_ATRASO_AUTOMATICO = 11;

/** Resultado de POST /reporteDiario/{fecha} para un dia: el reporte con result_code */
interface ResultadoApi {
  fecha?: string;
  secuencial?: number;
  estado?: string;
  result_code?: number;
  result_message?: string;
  result_detail?: string;
}

type Resultado =
  | { tipo: "pendiente" }
  | { tipo: "generando" }
  | { tipo: "generado"; secuencial?: number; estado?: string }
  | { tipo: "yaAceptado" }
  | { tipo: "error"; mensaje: string };

const mostrarResultado = (r: Resultado) => {
  switch (r.tipo) {
    case "pendiente":
      return <Tag>Pendiente</Tag>;
    case "generando":
      return <Tag color="processing">Generando…</Tag>;
    case "yaAceptado":
      return <Tag color="green">Ya estaba aceptado</Tag>;
    case "generado":
      return (
        <Space size={4}>
          {tagEstadoReporte(r.estado)}
          {r.secuencial !== undefined && (
            <Typography.Text type="secondary">
              secuencial {r.secuencial}
            </Typography.Text>
          )}
        </Space>
      );
    case "error":
      return <Typography.Text type="danger">{r.mensaje}</Typography.Text>;
  }
};

/** Resultado como texto, para ordenar por esa columna (generado: por el estado del reporte) */
const textoResultado = (r: Resultado) => {
  switch (r.tipo) {
    case "pendiente":
      return "Pendiente";
    case "generando":
      return "Generando";
    case "yaAceptado":
      return "Ya estaba aceptado";
    case "generado":
      return r.estado ?? null;
    case "error":
      return r.mensaje;
  }
};

/**
 * Genera y envia a DGI el reporte diario de los dias elegidos, de a uno (cada uno es una llamada a DGI). Con
 * soloFaltantes la API saltea los dias que ya tienen el reporte aceptado; sin el, los vuelve a generar con un
 * secuencial nuevo que reemplaza al aceptado.
 */
export function GenerarReportes({
  rut,
  fechas,
  soloFaltantes,
  reemplaza,
  onCerrar,
  onTerminado,
}: {
  rut: string;
  /** yyyy-MM-dd, del mas viejo al mas nuevo */
  fechas: string[];
  soloFaltantes: boolean;
  /** El dia ya esta aceptado: secuencial del reporte nuevo que lo reemplaza */
  reemplaza?: number;
  onCerrar: () => void;
  onTerminado: () => void;
}) {
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [generando, setGenerando] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const recientes = fechas.filter(
    (f) => dayjs().diff(dayjs(f), "day") < DIAS_ATRASO_AUTOMATICO,
  );

  const generar = async () => {
    setGenerando(true);
    for (const fecha of fechas) {
      setResultados((r) => ({ ...r, [fecha]: { tipo: "generando" } }));
      let resultado: Resultado;
      try {
        const respuesta = await apiJson<ResultadoApi[]>(
          "POST",
          `/empresa/${rut}/reporteDiario/${dayjs(fecha).format("YYYYMMDD")}`,
          { cantReportes: 1, soloFaltantes: soloFaltantes ? 1 : 0 },
          {},
        );
        const dia = respuesta?.[0];
        if (!dia) resultado = { tipo: "yaAceptado" };
        else if (dia.result_code)
          resultado = {
            tipo: "error",
            mensaje:
              [dia.result_message, dia.result_detail]
                .filter(Boolean)
                .join(": ") || "Error",
          };
        else
          resultado = {
            tipo: "generado",
            secuencial: dia.secuencial,
            estado: dia.estado,
          };
      } catch (e) {
        resultado = {
          tipo: "error",
          mensaje: (e as { message?: string })?.message ?? "Error",
        };
      }
      setResultados((r) => ({ ...r, [fecha]: resultado }));
    }
    setGenerando(false);
    setTerminado(true);
    onTerminado();
  };

  return (
    <Modal
      open
      title={reemplaza ? "Regenerar reporte diario" : "Generar reporte diario"}
      width={720}
      onCancel={generando ? undefined : onCerrar}
      closable={!generando}
      maskClosable={false}
      footer={
        <Space>
          <Button onClick={onCerrar} disabled={generando}>
            Cerrar
          </Button>
          {!terminado && (
            <Button type="primary" loading={generando} onClick={generar}>
              {reemplaza
                ? "Regenerar y enviar a DGI"
                : `Generar y enviar ${fechas.length} reporte${fechas.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Se genera el reporte de cada día y se envía a DGI en el momento.
          {soloFaltantes &&
            " Los días que ya tienen el reporte aceptado se saltean."}
        </Typography.Paragraph>
        {reemplaza && (
          <Alert
            type="info"
            showIcon
            message={`El día ya tiene un reporte aceptado: se envía uno nuevo con secuencial ${reemplaza} que lo reemplaza`}
            description="Se arma con los CFE que hay ahora en el sistema para ese día."
          />
        )}
        {recientes.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${recientes.length === 1 ? "Un día es" : `${recientes.length} días son`} de los últimos ${DIAS_ATRASO_AUTOMATICO - 1} días`}
            description="El proceso automático los reporta con atraso a propósito. Si después se emite o cambia algún CFE de ese día, habrá que regenerar el reporte."
          />
        )}
        <Table<{ fecha: string }>
          dataSource={fechas.map((fecha) => ({ fecha }))}
          rowKey="fecha"
          size="small"
          pagination={false}
          scroll={{ y: 360 }}
        >
          <Table.Column<{ fecha: string }>
            title="Día"
            sorter={ordenar<{ fecha: string }>(({ fecha }) => fecha)}
            render={(_, { fecha }) => dayjs(fecha).format("DD/MM/YYYY ddd")}
          />
          <Table.Column<{ fecha: string }>
            title="Resultado"
            sorter={ordenar<{ fecha: string }>(({ fecha }) =>
              textoResultado(resultados[fecha] ?? { tipo: "pendiente" }),
            )}
            render={(_, { fecha }) =>
              mostrarResultado(resultados[fecha] ?? { tipo: "pendiente" })
            }
          />
        </Table>
      </Space>
    </Modal>
  );
}
