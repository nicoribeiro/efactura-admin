import { KeyOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Result, Space, Typography } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiJson } from "../../api/http";

const MINIMO = 10;

interface PedidoCodigo {
  ok: boolean;
  vigenciaMinutos?: number;
}

interface Valores {
  codigo: string;
  nueva: string;
  confirmacion: string;
}

/**
 * Recuperacion de la contrasena sin sesion: se pide un codigo por mail y con el se elige una contrasena nueva. La API
 * responde lo mismo exista o no el email, y solo manda el codigo si el email esta confirmado.
 */
export function Recuperar() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<"email" | "codigo" | "listo">("email");
  const [email, setEmail] = useState("");
  const [vigencia, setVigencia] = useState(15);
  const [enviando, setEnviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  const [form] = Form.useForm<Valores>();

  const pedirCodigo = async (emailAddress: string) => {
    setEnviando(true);
    setError(undefined);
    try {
      const r = await apiJson<PedidoCodigo>("POST", "/recuperar", undefined, {
        emailAddress,
      });
      setEmail(emailAddress);
      if (r?.vigenciaMinutos) setVigencia(r.vigenciaMinutos);
      form.resetFields(["codigo"]);
      setPaso("codigo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = async (v: Valores) => {
    setGuardando(true);
    setError(undefined);
    try {
      await apiJson("POST", "/recuperar/password", undefined, {
        emailAddress: email,
        codigo: v.codigo,
        nueva: v.nueva,
      });
      setPaso("listo");
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
        {paso === "listo" ? (
          <Result
            status="success"
            title="Contraseña cambiada"
            subTitle="Se cerraron todas tus sesiones. Ingresá con la contraseña nueva."
            extra={
              <Button
                type="primary"
                onClick={() => navigate("/login", { replace: true })}
              >
                Ir a ingresar
              </Button>
            }
          />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              <KeyOutlined /> Recuperar contraseña
            </Typography.Title>
            {paso === "email" ? (
              <>
                <Typography.Text type="secondary">
                  Ingresá el email de tu usuario y te mandamos un código para
                  elegir una contraseña nueva. Solo funciona si confirmaste tu
                  email; si no, pedile a un administrador que te genere una
                  contraseña temporal.
                </Typography.Text>
                {error && <Alert type="error" showIcon message={error} />}
                <Form<{ emailAddress: string }>
                  layout="vertical"
                  requiredMark={false}
                  initialValues={{ emailAddress: email }}
                  onFinish={(v) => pedirCodigo(v.emailAddress.trim())}
                >
                  <Form.Item
                    name="emailAddress"
                    label="Email"
                    rules={[
                      { required: true, message: "Ingresá tu email" },
                      { type: "email", message: "Email inválido" },
                    ]}
                  >
                    <Input autoComplete="email" autoFocus />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={enviando}
                    block
                  >
                    Enviarme un código
                  </Button>
                </Form>
              </>
            ) : (
              <>
                <Alert
                  type="info"
                  showIcon
                  message={`Si el email corresponde a una cuenta con el email confirmado, te mandamos un código de 6 dígitos. Vale ${vigencia} minutos.`}
                  description={
                    <>
                      Enviado a <strong>{email}</strong>. Si no llega, revisá
                      la carpeta de spam. Si nunca confirmaste tu email,
                      pedile a un administrador una contraseña temporal.
                    </>
                  }
                />
                {error && <Alert type="error" showIcon message={error} />}
                <Form<Valores>
                  form={form}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={cambiar}
                >
                  <Form.Item
                    name="codigo"
                    label="Código"
                    normalize={(t: string) =>
                      (t ?? "").replace(/\D/g, "").slice(0, 6)
                    }
                    rules={[
                      { required: true, message: "Ingresá el código" },
                      { len: 6, message: "El código tiene 6 dígitos" },
                    ]}
                  >
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6 dígitos"
                      autoFocus
                      style={{ letterSpacing: 4 }}
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
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={guardando}
                    block
                  >
                    Cambiar contraseña
                  </Button>
                </Form>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Button
                    type="link"
                    style={{ padding: 0 }}
                    loading={enviando}
                    onClick={() => pedirCodigo(email)}
                  >
                    Pedir otro código
                  </Button>
                  <Button
                    type="link"
                    style={{ padding: 0 }}
                    onClick={() => {
                      setError(undefined);
                      setPaso("email");
                    }}
                  >
                    Usar otro email
                  </Button>
                </Space>
              </>
            )}
            <Link to="/login">Volver a ingresar</Link>
          </Space>
        )}
      </Card>
    </div>
  );
}
