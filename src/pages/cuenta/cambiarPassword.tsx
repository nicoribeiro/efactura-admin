import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { apiJson } from "../../api/http";
import {
  cuentaActual,
  debeCambiarPassword,
  debeConfirmarEmail,
  marcarEmailConfirmado,
  marcarPasswordCambiada,
  type Cuenta,
} from "../../providers/authProvider";
import { ConfirmacionEmail } from "./confirmarEmail";

const MINIMO = 10;

interface Valores {
  actual: string;
  nueva: string;
  confirmacion: string;
}

/**
 * Cuenta propia: estado del email (con su confirmacion si falta) y cambio de la contrasena. Con una contrasena temporal
 * es lo unico que se puede hacer (la API rechaza el resto hasta cambiarla); si no, se llega desde el encabezado. La API
 * no permite cambiar la contrasena sin el email confirmado.
 */
export function CambiarPassword() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { mutate: logout } = useLogout();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  const obligatorio = debeCambiarPassword();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);

  useEffect(() => {
    cuentaActual().then(setCuenta);
  }, []);

  // Sin datos (API anterior a la confirmacion) no se bloquea: si falta, lo rechaza la API
  const sinConfirmar = cuenta?.emailConfirmado === false;

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

  // El email se confirma antes que la contrasena temporal
  if (debeConfirmarEmail()) return <Navigate to="/confirmar-email" replace />;

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
            {obligatorio ? (
              <>
                <LockOutlined /> Cambiar contraseña
              </>
            ) : (
              "Mi cuenta"
            )}
          </Typography.Title>
          {obligatorio && (
            <Alert
              type="info"
              showIcon
              message="Ingresaste con una contraseña temporal"
              description="Elegí una contraseña nueva para continuar."
            />
          )}
          {cuenta && (
            <>
              <Space>
                <MailOutlined />
                <Typography.Text strong>{cuenta.emailAddress}</Typography.Text>
                {cuenta.emailConfirmado !== undefined &&
                  (cuenta.emailConfirmado ? (
                    <Tag color="green">Confirmado</Tag>
                  ) : (
                    <Tag color="orange">Sin confirmar</Tag>
                  ))}
              </Space>
              {sinConfirmar && (
                <>
                  <Alert
                    type="warning"
                    showIcon
                    message="Para cambiar la contraseña primero confirmá tu email"
                    description="Con el email confirmado también vas a poder recuperar la contraseña si te la olvidás."
                  />
                  <ConfirmacionEmail
                    onConfirmado={(c) => {
                      marcarEmailConfirmado(c);
                      setCuenta(c);
                      message.success("Email confirmado");
                    }}
                  />
                </>
              )}
              <Divider style={{ margin: 0 }} />
              {!obligatorio && (
                <Typography.Text strong>
                  <LockOutlined /> Cambiar contraseña
                </Typography.Text>
              )}
            </>
          )}
          {error && <Alert type="error" showIcon message={error} />}
          <Form<Valores>
            layout="vertical"
            onFinish={guardar}
            requiredMark={false}
            disabled={sinConfirmar}
          >
            <Form.Item
              name="actual"
              label={obligatorio ? "Contraseña temporal" : "Contraseña actual"}
              rules={[
                { required: true, message: "Ingresá la contraseña actual" },
              ]}
            >
              <Input.Password
                autoComplete="current-password"
                autoFocus={!sinConfirmar}
              />
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
                <Button onClick={() => logout()} disabled={false}>
                  Salir
                </Button>
              ) : (
                <Button onClick={() => navigate(-1)} disabled={false}>
                  Cancelar
                </Button>
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
