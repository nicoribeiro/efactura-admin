import { CheckCircleOutlined, CloseCircleOutlined, SendOutlined, UndoOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";

/** Rechazos comerciales que puede hacer el receptor (tabla 4.3 del formato de mensaje de respuesta de DGI) */
const MOTIVOS_COMERCIALES: { codigo: string; texto: string }[] = [
  { codigo: "E20", texto: "Orden de compra vencida" },
  { codigo: "E21", texto: "Mercadería en mal estado" },
  { codigo: "E22", texto: "Proveedor inhabilitado por organismo de contralor" },
  { codigo: "E23", texto: "Contraprestación no recibida" },
  { codigo: "E24", texto: "Diferencia precios y/o descuentos" },
  { codigo: "E25", texto: "Factura con error cálculos" },
  { codigo: "E26", texto: "Diferencia con plazos" },
];

const esComercial = (codigo: string) => codigo >= "E20";

/** Lo que el panel necesita del sobre recibido para la respuesta a sus CFE (SobreSerializer) */
export interface SobreRespuesta {
  id: number;
  estadoEmpresa?: string | null;
  respuestaCfes?: { nombreArchivo?: string | null } | null;
  respuestaCfePendiente?: boolean;
  respuestaCfeProgramada?: string | null;
}

/**
 * Estado de la respuesta a los CFE (ME_) de un sobre recibido: enviada, pendiente (y cuando sale sola) o sin respuesta
 * (sobres rechazados o anteriores a esta funcionalidad). Con la respuesta pendiente permite enviarla ahora.
 */
export function RespuestaCfeEstado({
  rut,
  sobre,
  onEnviada,
}: {
  rut: string;
  sobre: SobreRespuesta;
  onEnviada: () => void;
}) {
  const { message, modal } = App.useApp();
  const [enviando, setEnviando] = useState(false);

  if (sobre.respuestaCfes)
    return (
      <Space size={8} wrap>
        <Tag color="green" icon={<CheckCircleOutlined />}>
          Enviada
        </Tag>
        <Typography.Text type="secondary">{sobre.respuestaCfes.nombreArchivo}</Typography.Text>
      </Space>
    );

  if (sobre.estadoEmpresa === "BS")
    return <Typography.Text type="secondary">Sobre rechazado: sus CFE no se responden</Typography.Text>;

  if (!sobre.respuestaCfePendiente)
    return <Typography.Text type="secondary">Sin respuesta (sobre recibido antes de que se respondieran los CFE)</Typography.Text>;

  const enviar = () =>
    modal.confirm({
      title: "Enviar ahora la respuesta a los CFE",
      content:
        "Se le envía al emisor la aceptación o el rechazo de cada CFE del sobre. Después ya no se puede rechazar ninguno.",
      okText: "Enviar",
      cancelText: "Cancelar",
      onOk: async () => {
        setEnviando(true);
        try {
          const r = await apiJson<{ respuesta: string }>("POST", `/empresa/${rut}/sobres/recibidos/${sobre.id}/responderCfes`);
          message.success(`Respuesta enviada (${r.respuesta})`);
          onEnviada();
        } catch (e) {
          message.error((e as { message?: string })?.message ?? "Error");
        } finally {
          setEnviando(false);
        }
      },
    });

  return (
    <Space size={8} wrap>
      <Tag color="gold">Pendiente</Tag>
      <Typography.Text type="secondary">
        {sobre.respuestaCfeProgramada
          ? `Se envía sola el ${formatFechaApi(sobre.respuestaCfeProgramada)}`
          : "No se envía sola: la empresa responde a mano"}
      </Typography.Text>
      <Button size="small" icon={<SendOutlined />} loading={enviando} onClick={enviar}>
        Enviar ahora
      </Button>
    </Space>
  );
}

/**
 * Rechazo comercial de un CFE recibido (E20-E26), o deshacerlo, mientras la respuesta a los CFE de su sobre esta
 * pendiente: el rechazo va en esa respuesta.
 */
export function RechazoComercial({
  rut,
  cfeId,
  motivos,
  detalle,
  pendiente,
  onCambio,
}: {
  rut: string;
  cfeId: number;
  /** Motivos de rechazo del CFE (los de los controles y los comerciales) */
  motivos: string[];
  detalle?: string | null;
  /** La respuesta del sobre esta pendiente: se puede rechazar o deshacer */
  pendiente: boolean;
  onCambio: () => void;
}) {
  const { message, modal } = App.useApp();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm<{ motivo: string; detalle?: string }>();

  const comerciales = motivos.filter(esComercial);
  if (!pendiente && comerciales.length === 0) return null;

  const enviar = async (motivo: string | null, detalleRechazo?: string) => {
    setGuardando(true);
    try {
      await apiJson("PUT", `/empresa/${rut}/documentos/recibidos/${cfeId}/rechazo`, undefined, {
        motivo,
        detalle: detalleRechazo ?? "",
      });
      message.success(motivo ? "CFE rechazado: va en la respuesta al emisor" : "Rechazo deshecho");
      setAbierto(false);
      onCambio();
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setGuardando(false);
    }
  };

  if (comerciales.length > 0)
    return (
      <Space size={8} wrap>
        <Tag color="red" icon={<CloseCircleOutlined />}>
          Rechazado {comerciales.join(", ")}
        </Tag>
        {detalle && <Typography.Text type="secondary">{detalle}</Typography.Text>}
        {pendiente && (
          <Button
            size="small"
            icon={<UndoOutlined />}
            loading={guardando}
            onClick={() =>
              modal.confirm({
                title: "Deshacer el rechazo",
                content: "El CFE vuelve a ir aceptado en la respuesta al emisor (salvo que lo rechace un control de recepción).",
                okText: "Deshacer",
                cancelText: "Cancelar",
                onOk: () => enviar(null),
              })
            }
          >
            Deshacer rechazo
          </Button>
        )}
      </Space>
    );

  return (
    <>
      <Button danger icon={<CloseCircleOutlined />} onClick={() => setAbierto(true)}>
        Rechazar
      </Button>
      <Modal
        open={abierto}
        title="Rechazar el CFE"
        okText="Rechazar"
        okButtonProps={{ danger: true }}
        cancelText="Cancelar"
        confirmLoading={guardando}
        onOk={() => form.submit()}
        onCancel={() => setAbierto(false)}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          El rechazo va en la respuesta a los CFE que se le envía al emisor. El CFE sigue siendo válido
          para DGI: si corresponde, el emisor tiene que hacer una nota de corrección.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={(v) => enviar(v.motivo, v.detalle)} requiredMark={false}>
          <Form.Item name="motivo" label="Motivo" rules={[{ required: true, message: "Elegí un motivo" }]}>
            <Select
              options={MOTIVOS_COMERCIALES.map((m) => ({ value: m.codigo, label: `${m.codigo} – ${m.texto}` }))}
            />
          </Form.Item>
          <Form.Item name="detalle" label="Detalle" extra="Opcional, hasta 500 caracteres: se le envía al emisor.">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
