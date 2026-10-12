import { LockOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import { Alert, App, Button, Card, Form, Input, Space, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import { apiJson } from "../../api/http";
import {
  debeCambiarPassword,
  marcarPasswordCambiada,
} from "../../providers/authProvider";

const MINIMO = 10;

interface Valores {
  actual: string;
  nueva: string;
  confirmacion: string;
}

/**
 * Cambio de la contrasena propia. Con una contrasena temporal es lo unico que se puede hacer (la API rechaza el resto
 * hasta cambiarla); si no, se llega desde el encabezado.
 */
export function CambiarPassword() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { mutate: logout } = useLogout();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  const obligatorio = debeCambiarPassword();

  const guardar = async (v: Valores) => {
    setGuardando(true);
    setError(undefined);
    try {
      await apiJson("PUT", "/cuenta/password", undefined, {
        actual: v.actual,
        nueva: v.nueva,
      });
      marcarPasswordCambiada();
      message.success("Contraseña cambiada");
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "48px 16px",
      }}
    >
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <LockOutlined /> Cambiar contraseña
          </Typography.Title>
          {obligatorio && (
            <Alert
              type="info"
              showIcon
              message="Ingresaste con una contraseña temporal"
              description="Elegí una contraseña nueva para continuar."
            />
          )}
          {error && <Alert type="error" showIcon message={error} />}
          <Form<Valores>
            layout="vertical"
            onFinish={guardar}
            requiredMark={false}
          >
            <Form.Item
              name="actual"
              label={obligatorio ? "Contraseña temporal" : "Contraseña actual"}
              rules={[
                { required: true, message: "Ingresá la contraseña actual" },
              ]}
            >
              <Input.Password autoComplete="current-password" autoFocus />
            </Form.Item>
            <Form.Item
              name="nueva"
              label="Contraseña nueva"
              rules={[
                { required: true, message: "Ingresá la contraseña nueva" },
                { min: MINIMO, message: `Al menos ${MINIMO} caracteres` },
              ]}
              hasFeedback
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmacion"
              label="Repetir contraseña nueva"
              dependencies={["nueva"]}
              hasFeedback
              rules={[
                { required: true, message: "Repetí la contraseña nueva" },
                ({ getFieldValue }) => ({
                  validator: (_, valor) =>
                    !valor || getFieldValue("nueva") === valor
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("No coincide con la contraseña nueva"),
                        ),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              {obligatorio ? (
                <Button onClick={() => logout()}>Salir</Button>
              ) : (
                <Button onClick={() => navigate(-1)}>Cancelar</Button>
              )}
              <Button type="primary" htmlType="submit" loading={guardando}>
                Guardar
              </Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
