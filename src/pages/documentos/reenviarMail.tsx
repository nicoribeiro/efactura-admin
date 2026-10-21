import { MailOutlined } from "@ant-design/icons";
import { App, Button, Space, Typography } from "antd";
import { useState } from "react";
import { apiJson } from "../../api/http";
import type { DocumentoRef } from "./useSobre";

interface Destino {
  destino?: string;
  motivo?: string;
}

/**
 * Reenvia por mail un comprobante emitido (ADMIN y USER): el XML al receptor electronico y el PDF a la direccion del
 * comprobante. Antes de enviar muestra a quien va y pide confirmacion.
 */
export function ReenviarMail({
  rut,
  documento,
  onEnviado,
}: {
  rut: string;
  documento: DocumentoRef;
  /** Se llama despues de cada intento (salga bien o mal), para refrescar el historial */
  onEnviado?: () => void;
}) {
  const { modal, message } = App.useApp();
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    try {
      const r = await apiJson<{ enviados: string[] }>(
        "POST",
        `/empresa/${rut}/documentos/reenviarMail`,
        { ...documento },
      );
      message.success(`Enviado: ${r.enviados.join(" y ")}`);
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      onEnviado?.();
    }
  };

  const confirmar = async () => {
    setCargando(true);
    try {
      const d = await apiJson<{ xml: Destino; pdf: Destino }>(
        "GET",
        `/empresa/${rut}/documentos/destinosMail`,
        { ...documento },
      );
      const fila = (que: string, x: Destino) => (
        <div>
          <b>{que}:</b>{" "}
          {x.destino ?? (
            <Typography.Text type="secondary">no se envía ({x.motivo})</Typography.Text>
          )}
        </div>
      );
      const hay = !!(d.xml.destino || d.pdf.destino);
      modal.confirm({
        title: hay ? "¿Reenviar el CFE por mail?" : "No hay a quién enviarlo",
        icon: <MailOutlined />,
        content: (
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            {fila("XML (receptor electrónico)", d.xml)}
            {fila("PDF", d.pdf)}
          </Space>
        ),
        okText: "Enviar",
        okButtonProps: { disabled: !hay },
        cancelText: hay ? "Cancelar" : "Cerrar",
        onOk: enviar,
      });
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button icon={<MailOutlined />} loading={cargando} onClick={confirmar}>
      Reenviar por mail
    </Button>
  );
}
