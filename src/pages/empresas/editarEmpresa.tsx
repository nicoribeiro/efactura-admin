import { App, Divider, Form, Input, Modal } from "antd";
import { useState } from "react";
import { apiJson } from "../../api/http";
import type { Empresa } from "../../contexts/empresa";

/** Campos editables (los nombres son los de PUT /empresa/:rut) */
const CAMPOS = [
  "razon",
  "nombreComercial",
  "paginaWeb",
  "resolucion",
  "mailRecepcion",
  "hostRecepcion",
  "puertoRecepcion",
  "userRecepcion",
  "mailNotificaciones",
  "fromEnvio",
] as const;

type Campo = (typeof CAMPOS)[number];
type Valores = Partial<Record<Campo, string>> & { passRecepcion?: string };

/**
 * Edicion de los datos generales y de correo de una empresa (solo ADMIN). Se envian solo los campos que cambiaron; la
 * contrasena IMAP se envia solo si se escribe una nueva (la API nunca la devuelve).
 */
export function EditarEmpresa({
  empresa,
  onCerrar,
  onGuardada,
}: {
  empresa: Empresa;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Valores>();
  const [guardando, setGuardando] = useState(false);

  const iniciales: Valores = Object.fromEntries(
    CAMPOS.map((c) => [c, (empresa[c as keyof Empresa] as string | undefined) ?? ""]),
  );

  const guardar = async (valores: Valores) => {
    const cambios: Record<string, string> = {};
    for (const campo of CAMPOS) {
      const nuevo = (valores[campo] ?? "").trim();
      if (nuevo !== (iniciales[campo] ?? "")) cambios[campo] = nuevo;
    }
    if (valores.passRecepcion) cambios.passRecepcion = valores.passRecepcion;

    if (Object.keys(cambios).length === 0) {
      message.info("No hay cambios");
      onCerrar();
      return;
    }

    setGuardando(true);
    try {
      await apiJson("PUT", `/empresa/${empresa.rut}`, undefined, cambios);
      message.success("Empresa actualizada");
      onGuardada();
      onCerrar();
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      title={`Editar ${empresa.razon ?? empresa.rut}`}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={guardando}
      onOk={() => form.submit()}
      onCancel={onCerrar}
      width={640}
      maskClosable={false}
      destroyOnHidden
    >
      <Form<Valores>
        form={form}
        layout="vertical"
        initialValues={iniciales}
        onFinish={guardar}
        requiredMark={false}
      >
        <Divider orientation="left" plain style={{ marginTop: 0 }}>
          Datos generales
        </Divider>
        <Form.Item
          name="razon"
          label="Razón social"
          rules={[{ required: true, whitespace: true, message: "Requerida" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="nombreComercial" label="Nombre comercial">
          <Input />
        </Form.Item>
        <Form.Item name="paginaWeb" label="Página web">
          <Input placeholder="https://…" />
        </Form.Item>
        <Form.Item name="resolucion" label="Resolución DGI">
          <Input />
        </Form.Item>

        <Divider orientation="left" plain>
          Correo
        </Divider>
        <Form.Item
          name="mailRecepcion"
          label="Mail de recepción de comprobantes"
          rules={[{ type: "email", message: "Mail inválido" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Servidor IMAP" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Form.Item name="hostRecepcion" style={{ flex: 1 }}>
              <Input placeholder="imap.ejemplo.com" />
            </Form.Item>
            <Form.Item
              name="puertoRecepcion"
              style={{ width: 110 }}
              rules={[{ pattern: /^\d*$/, message: "Número" }]}
            >
              <Input placeholder="993" />
            </Form.Item>
          </div>
        </Form.Item>
        <Form.Item name="userRecepcion" label="Usuario IMAP">
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="passRecepcion"
          label="Contraseña IMAP"
          extra="Dejala vacía para no cambiarla. No se muestra la actual."
        >
          <Input.Password autoComplete="new-password" placeholder="Sin cambios" />
        </Form.Item>
        <Form.Item
          name="mailNotificaciones"
          label="Mail de notificaciones"
          rules={[{ type: "email", message: "Mail inválido" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="fromEnvio"
          label="Remitente de los envíos"
          extra="Dirección desde la que se envían los comprobantes a los receptores."
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
