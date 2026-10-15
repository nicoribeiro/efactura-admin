import { MailOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Space,
  Spin,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { apiJson } from "../../api/http";
import {
  cuentaActual,
  debeConfirmarEmail,
  marcarEmailConfirmado,
  pasoObligatorio,
  type Cuenta,
} from "../../providers/authProvider";

interface CodigoEnviado {
  enviado: boolean;
  email: string;
  vigenciaMinutos: number;
}

/** Solo los 6 digitos del codigo (se descartan espacios y guiones al pegarlo) */
const limpiarCodigo = (texto: string) => texto.replace(/\D/g, "").slice(0, 6);

/**
 * Confirmacion del email propio: se pide un codigo de 6 digitos que llega por mail y se ingresa aca. Se usa en la
 * pantalla obligatoria de los usuarios nuevos y en la cuenta propia (ahi es opcional).
 */
export function ConfirmacionEmail({
  email,
  onConfirmado,
}: {
  email?: string;
  onConfirmado: (cuenta: Cuenta) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<CodigoEnviado>();
  const [codigo, setCodigo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();

  const enviar = async () => {
    setEnviando(true);
    setError(undefined);
    try {
      setEnviado(await apiJson<CodigoEnviado>("POST", "/cuenta/email/codigo"));
      setCodigo("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (codigo.length !== 6) {
      setError("Ingresá los 6 dígitos del código");
      return;
    }
    setConfirmando(true);
    setError(undefined);
    try {
      const cuenta = await apiJson<Cuenta>(
        "POST",
        "/cuenta/email/confirmar",
        undefined,
        { codigo },
      );
      onConfirmado(cuenta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {email && (
        <Typography.Text>
          Email: <Typography.Text strong>{email}</Typography.Text>
        </Typography.Text>
      )}
      {enviado ? (
        <Alert
          type="success"
          showIcon
          message={`Te mandamos un código a ${enviado.email}`}
          description={`Vale ${enviado.vigenciaMinutos} minutos. Si no llega, revisá la carpeta de spam.`}
        />
      ) : (
        <Typography.Text type="secondary">
          Te mandamos un código de 6 dígitos a tu email para confirmar que es
          tuyo.
        </Typography.Text>
      )}
      {error && <Alert type="error" showIcon message={error} />}
      {enviado && (
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
            onPressEnter={confirmar}
            placeholder="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            style={{ letterSpacing: 4 }}
          />
          <Button
            type="primary"
            onClick={confirmar}
            loading={confirmando}
            disabled={codigo.length !== 6}
          >
            Confirmar
          </Button>
        </Space.Compact>
      )}
      <Button
        icon={<MailOutlined />}
        onClick={enviar}
        loading={enviando}
        type={enviado ? "link" : "default"}
        style={enviado ? { padding: 0 } : undefined}
      >
        {enviado ? "Pedir otro código" : "Enviarme un código"}
      </Button>
    </Space>
  );
}

/**
 * Pantalla obligatoria para los usuarios nuevos: hasta confirmar el email la API rechaza el resto. Despues sigue el
 * cambio de la contrasena temporal, si corresponde.
 */
export function ConfirmarEmail() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { mutate: logout } = useLogout();
  const [cuenta, setCuenta] = useState<Cuenta | null>();
  const obligatorio = debeConfirmarEmail();

  const continuar = (c?: Cuenta) => {
    marcarEmailConfirmado(c);
    navigate(pasoObligatorio() ?? "/", { replace: true });
  };

  useEffect(() => {
    if (!obligatorio) return;
    cuentaActual().then((c) => {
      // Ya confirmado (por ejemplo desde otra pestaña): sigue sin pedir el codigo
      if (c?.emailConfirmado) {
        marcarEmailConfirmado(c);
        navigate(pasoObligatorio() ?? "/", { replace: true });
      } else setCuenta(c);
    });
  }, [obligatorio, navigate]);

  // Sin la marca no hay nada que hacer aca: la confirmacion opcional esta en la cuenta propia
  if (!obligatorio) return <Navigate to={pasoObligatorio() ?? "/"} replace />;

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
            <MailOutlined /> Confirmá tu email
          </Typography.Title>
          <Alert
            type="info"
            showIcon
            message="Antes de usar el panel tenés que confirmar tu email"
            description="Con el email confirmado vas a poder recuperar la contraseña si te la olvidás."
          />
          {cuenta === undefined ? (
            <Spin />
          ) : (
            <ConfirmacionEmail
              email={cuenta?.emailAddress}
              onConfirmado={(c) => {
                message.success("Email confirmado");
                continuar(c);
              }}
            />
          )}
          <Button onClick={() => logout()}>Salir</Button>
        </Space>
      </Card>
    </div>
  );
}
