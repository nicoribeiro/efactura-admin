import { RedoOutlined, StopOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, Modal, Progress, Space, Tooltip, Typography } from "antd";
import { useState } from "react";
import { apiJson } from "../../api/http";

type EstadoAdjunto = "PROCESADO_OK" | "PROCESADO_ERROR" | "PENDIENTE" | "OMITIDO";

/** Respuesta de PUT /emailEntrantes/:id?accion=RETRY: el estado de cada adjunto despues del reintento */
interface Reintento {
  attachments: { id: number; name?: string | null; estado?: EstadoAdjunto | null; error?: string | null }[];
}

interface Totales {
  procesados: number;
  omitidos: number;
  errores: number;
  pendientes: number;
}

const contar = (r: Reintento, t: Totales) => {
  for (const a of r.attachments) {
    if (a.estado === "PROCESADO_OK") t.procesados++;
    else if (a.estado === "OMITIDO") t.omitidos++;
    else if (a.estado === "PROCESADO_ERROR") t.errores++;
    else t.pendientes++;
  }
  return t;
};

const resumen = (t: Totales) =>
  [
    t.procesados && `${t.procesados} procesado${t.procesados === 1 ? "" : "s"}`,
    t.omitidos && `${t.omitidos} omitido${t.omitidos === 1 ? "" : "s"}`,
    t.errores && `${t.errores} con error`,
    t.pendientes && `${t.pendientes} pendiente${t.pendientes === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(", ") || "sin adjuntos para procesar";

/** Reprocesa los adjuntos de un email que no estan procesados OK */
const reintentar = (rut: string, emailId: number) =>
  apiJson<Reintento>("PUT", `/empresa/${rut}/emailEntrantes/${emailId}`, { accion: "RETRY" });

/**
 * Boton (solo ADMIN) para marcar como omitidos los adjuntos con error o pendientes de un email, ej. sobres viejos que
 * no se van a poder procesar: dejan de figurar con error y "Reintentar todos" no los vuelve a intentar
 */
export function OmitirEmail({ rut, emailId, onTerminado }: { rut: string; emailId: number; onTerminado: () => void }) {
  const { message, modal } = App.useApp();
  const [cargando, setCargando] = useState(false);

  const omitir = async () => {
    setCargando(true);
    try {
      const r = await apiJson<{ omitidos: string[] }>("PUT", `/empresa/${rut}/emailEntrantes/${emailId}`, { accion: "OMIT" });
      message.success(r.omitidos.length ? `Omitido: ${r.omitidos.join(", ")}` : "No había adjuntos para omitir");
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setCargando(false);
      onTerminado();
    }
  };

  return (
    <Tooltip title="Omitir">
      <Button
        size="small"
        icon={<StopOutlined />}
        loading={cargando}
        onClick={(e) => {
          e.stopPropagation();
          modal.confirm({
            title: "Omitir los adjuntos con error de este email",
            content:
              "Quedan como omitidos: no se procesan ni se vuelven a reintentar, y no se le responde nada al emisor. El error queda guardado.",
            okText: "Omitir",
            cancelText: "Cancelar",
            onOk: omitir,
          });
        }}
        aria-label="Omitir"
      />
    </Tooltip>
  );
}

/** Boton para reintentar un email con adjuntos con error o pendientes */
export function ReintentarEmail({
  rut,
  emailId,
  conSobre,
  soloIcono,
  onTerminado,
}: {
  rut: string;
  emailId: number;
  /** Trae un sobre recibido sin registrar: reprocesarlo le responde al emisor, se confirma antes */
  conSobre?: boolean;
  /** Solo el icono (con tooltip), como las acciones de la tabla de comprobantes */
  soloIcono?: boolean;
  onTerminado: () => void;
}) {
  const { message, modal } = App.useApp();
  const [cargando, setCargando] = useState(false);

  const click = async () => {
    setCargando(true);
    try {
      const r = await reintentar(rut, emailId);
      const t = contar(r, { procesados: 0, omitidos: 0, errores: 0, pendientes: 0 });
      const error = r.attachments.find((a) => a.estado === "PROCESADO_ERROR")?.error;
      if (t.errores) message.warning(`Reintentado: ${resumen(t)}${error ? ` (${error})` : ""}`);
      else message.success(`Reintentado: ${resumen(t)}`);
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setCargando(false);
      onTerminado();
    }
  };

  const confirmarYReintentar = () => {
    if (!conSobre) return click();
    modal.confirm({
      title: "Este email trae un sobre recibido que nunca se registró",
      content:
        "Reprocesarlo registra el sobre y sus comprobantes (puede ser de un período pasado) y le envía la respuesta (ACK) al emisor.",
      okText: "Reintentar y responder",
      cancelText: "Cancelar",
      onOk: click,
    });
  };

  if (soloIcono)
    return (
      <Tooltip title="Reintentar">
        <Button
          size="small"
          icon={<RedoOutlined />}
          loading={cargando}
          onClick={(e) => {
            e.stopPropagation();
            confirmarYReintentar();
          }}
          aria-label="Reintentar"
        />
      </Tooltip>
    );

  return (
    <Button size="small" icon={<RedoOutlined />} loading={cargando} onClick={confirmarYReintentar}>
      Reintentar
    </Button>
  );
}

/** Email con error y si trae un sobre recibido (Sob_): reprocesarlo registra el sobre y le responde al emisor */
interface EmailConError {
  id: number;
  conSobre: boolean;
}

/**
 * Reintenta los emails con algun adjunto con error, de a uno, con progreso y resumen al final. Por defecto deja afuera
 * los que traen un sobre recibido (Sob_): reprocesarlo registra el sobre y sus comprobantes y le envia la respuesta
 * (ACK) al emisor, que puede ser de hace mucho. Se incluyen solo marcandolo.
 */
export function ReintentarTodos({ rut, onTerminado }: { rut: string; onTerminado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [conError, setConError] = useState<EmailConError[]>();
  const [incluirSobres, setIncluirSobres] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [hechos, setHechos] = useState(0);
  const [totales, setTotales] = useState<Totales>();
  const [fallidos, setFallidos] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const abrir = async () => {
    setAbierto(true);
    setConError(undefined);
    setIncluirSobres(false);
    setHechos(0);
    setTotales(undefined);
    setFallidos([]);
    setError(undefined);
    setBuscando(true);
    try {
      // Todos los emails con algun adjunto con error (la API pagina de a 50)
      const todos: EmailConError[] = [];
      for (let page = 1; ; page++) {
        const r = await apiJson<{
          results: { id: number; attachments: { name?: string | null; estado?: string | null }[] }[];
          count: number;
        }>("GET", `/empresa/${rut}/emails`, { estado: "PROCESADO_ERROR", page, pageSize: 50 });
        todos.push(
          ...r.results.map((e) => ({
            id: e.id,
            conSobre: e.attachments.some(
              (a) => /^Sob/i.test(a.name ?? "") && a.estado !== "PROCESADO_OK" && a.estado !== "OMITIDO",
            ),
          })),
        );
        if (!r.results.length || page * 50 >= r.count) break;
      }
      setConError(todos);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Error");
    } finally {
      setBuscando(false);
    }
  };

  const sobres = conError?.filter((e) => e.conSobre).length ?? 0;
  const ids = conError?.filter((e) => incluirSobres || !e.conSobre).map((e) => e.id);

  const correr = async () => {
    if (!ids) return;
    setCorriendo(true);
    const t: Totales = { procesados: 0, omitidos: 0, errores: 0, pendientes: 0 };
    const mal: string[] = [];
    for (const id of ids) {
      try {
        contar(await reintentar(rut, id), t);
      } catch (e) {
        mal.push(`Email ${id}: ${(e as { message?: string })?.message ?? "error"}`);
      }
      setHechos((n) => n + 1);
      setTotales({ ...t });
    }
    setFallidos(mal);
    setCorriendo(false);
    onTerminado();
  };

  const terminado = !!ids && hechos === ids.length && !corriendo && ids.length > 0;

  return (
    <>
      <Button icon={<RedoOutlined />} onClick={abrir}>
        Reintentar todos los con error
      </Button>
      <Modal
        open={abierto}
        title="Reintentar emails con error"
        onCancel={() => !corriendo && setAbierto(false)}
        closable={!corriendo}
        maskClosable={false}
        footer={
          <Space>
            <Button onClick={() => setAbierto(false)} disabled={corriendo}>
              Cerrar
            </Button>
            {!terminado && (
              <Button
                type="primary"
                loading={corriendo}
                disabled={!ids?.length || buscando}
                onClick={correr}
              >
                Reintentar {ids?.length ?? ""} email{ids?.length === 1 ? "" : "s"}
              </Button>
            )}
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {error && <Alert type="error" showIcon message={error} />}
          {buscando && <Typography.Text type="secondary">Buscando emails con error…</Typography.Text>}
          {conError && conError.length === 0 && <Alert type="success" showIcon message="No hay emails con error" />}
          {conError && conError.length > 0 && !corriendo && hechos === 0 && (
            <>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                Se reprocesan, de a uno, los adjuntos que no están procesados de {ids?.length ?? 0} email
                {ids?.length === 1 ? "" : "s"}. Las respuestas a sobres propios y los archivos que no son XML no
                envían mails.
              </Typography.Paragraph>
              {sobres > 0 && (
                <Alert
                  type={incluirSobres ? "warning" : "info"}
                  showIcon
                  message={`${sobres} email${sobres === 1 ? " trae" : "s traen"} un sobre recibido que nunca se registró`}
                  description={
                    <Space direction="vertical">
                      <span>
                        Reprocesarlos registra los sobres y sus comprobantes (pueden ser de períodos pasados) y le
                        envía la respuesta (ACK) a cada emisor.
                      </span>
                      <Checkbox checked={incluirSobres} onChange={(e) => setIncluirSobres(e.target.checked)}>
                        Incluirlos y enviar las respuestas a los emisores
                      </Checkbox>
                    </Space>
                  }
                />
              )}
            </>
          )}
          {ids && ids.length > 0 && (corriendo || hechos > 0) && (
            <Progress percent={Math.round((hechos / ids.length) * 100)} format={() => `${hechos} / ${ids.length}`} />
          )}
          {totales && <Typography.Text>Adjuntos: {resumen(totales)}</Typography.Text>}
          {terminado && fallidos.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${fallidos.length} email${fallidos.length === 1 ? "" : "s"} no se pudieron reintentar`}
              description={fallidos.slice(0, 10).join("; ")}
            />
          )}
        </Space>
      </Modal>
    </>
  );
}
