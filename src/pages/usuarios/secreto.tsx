import { Alert, Modal, Space, Typography } from "antd";

/**
 * Muestra una contrasena temporal o un secret una sola vez (la API no lo vuelve a devolver), con boton para copiar.
 */
export function MostrarSecreto({
  titulo,
  valores,
  aviso,
  onCerrar,
}: {
  titulo: string;
  valores: { label: string; valor: string }[];
  aviso: string;
  onCerrar: () => void;
}) {
  return (
    <Modal
      open
      title={titulo}
      onCancel={onCerrar}
      onOk={onCerrar}
      okText="Listo, ya lo copié"
      cancelButtonProps={{ style: { display: "none" } }}
      maskClosable={false}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Se muestra una sola vez"
          description={aviso}
        />
        {valores.map((v) => (
          <div key={v.label}>
            <Typography.Text type="secondary">{v.label}</Typography.Text>
            <Typography.Paragraph
              copyable={{ text: v.valor, tooltips: ["Copiar", "Copiado"] }}
              code
              style={{ fontSize: 15, marginBottom: 0, wordBreak: "break-all" }}
            >
              {v.valor}
            </Typography.Paragraph>
          </div>
        ))}
      </Space>
    </Modal>
  );
}
