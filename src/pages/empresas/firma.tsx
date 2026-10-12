import { SafetyCertificateOutlined, UploadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Tabs,
  Typography,
  Upload,
} from "antd";
import { useState } from "react";
import { apiJson } from "../../api/http";
import { aBase64 } from "../../utils/archivos";

type Modo = "pkcs12" | "pem";

interface FirmaCargada {
  titular: string;
  emisor: string;
  rutEnCertificado: boolean;
}

/** Selector de un archivo (no se sube: se lee en el navegador) */
function Archivo({
  accept,
  archivo,
  onChange,
  texto,
}: {
  accept: string;
  archivo?: File;
  onChange: (f: File) => void;
  texto: string;
}) {
  return (
    <Space>
      <Upload
        accept={accept}
        showUploadList={false}
        beforeUpload={(f) => {
          onChange(f);
          return false;
        }}
      >
        <Button icon={<UploadOutlined />}>{texto}</Button>
      </Upload>
      {archivo && <Typography.Text>{archivo.name}</Typography.Text>}
    </Space>
  );
}

/**
 * Carga de la firma digital de la empresa (solo ADMIN): el archivo .p12/.pfx que entrega la autoridad certificadora con
 * su contrasena, o el certificado y la clave privada en PEM. Los archivos se leen en el navegador y se envian a la API,
 * que valida que la clave corresponda al certificado, que este vigente y que mencione el RUT de la empresa.
 */
export function CargarFirma({
  rut,
  onCerrar,
  onCargada,
}: {
  rut: string;
  onCerrar: () => void;
  onCargada: () => void;
}) {
  const { modal, message } = App.useApp();
  const [modo, setModo] = useState<Modo>("pkcs12");
  const [p12, setP12] = useState<File>();
  const [password, setPassword] = useState("");
  const [certificado, setCertificado] = useState<File>();
  const [clave, setClave] = useState<File>();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();
  const [resultado, setResultado] = useState<FirmaCargada>();

  const listo = modo === "pkcs12" ? !!p12 : !!certificado && !!clave;

  const enviar = async (forzarFirma = false) => {
    setCargando(true);
    setError(undefined);
    try {
      const body =
        modo === "pkcs12"
          ? { pkcs12: await aBase64(p12!), pkcs12Password: password }
          : {
              certificado: await certificado!.text(),
              privateKey: await clave!.text(),
            };
      const r = await apiJson<{ firmaCargada?: FirmaCargada }>(
        "PUT",
        `/empresa/${rut}`,
        undefined,
        { ...body, ...(forzarFirma ? { forzarFirma: true } : {}) },
      );
      setResultado(r.firmaCargada);
      message.success("Firma digital cargada");
      onCargada();
    } catch (e) {
      const texto = (e as { message?: string })?.message ?? "Error";
      // El certificado no menciona el RUT: se confirma antes de cargarlo igual
      if (!forzarFirma && texto.includes("forzarFirma")) {
        modal.confirm({
          title: "El certificado no menciona el RUT de la empresa",
          content: texto.replace(/\. Para cargarlo igual.*$/, "."),
          okText: "Cargar igual",
          okButtonProps: { danger: true },
          cancelText: "Cancelar",
          onOk: () => enviar(true),
        });
      } else setError(texto);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      open
      title="Cargar firma digital"
      onCancel={onCerrar}
      maskClosable={false}
      width={600}
      footer={
        resultado ? (
          <Button type="primary" onClick={onCerrar}>
            Cerrar
          </Button>
        ) : (
          <Space>
            <Button onClick={onCerrar} disabled={cargando}>
              Cancelar
            </Button>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              disabled={!listo}
              loading={cargando}
              onClick={() => enviar()}
            >
              Cargar
            </Button>
          </Space>
        )
      }
    >
      {resultado ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert type="success" showIcon message="La firma digital quedó cargada" />
          <Typography.Text>
            <b>Titular:</b> {resultado.titular}
          </Typography.Text>
          <Typography.Text>
            <b>Emitido por:</b> {resultado.emisor}
          </Typography.Text>
          {!resultado.rutEnCertificado && (
            <Alert
              type="warning"
              showIcon
              message="El certificado no menciona el RUT de la empresa"
            />
          )}
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Reemplaza la firma actual. Se verifica que la clave corresponda al
            certificado y que esté vigente. La clave privada nunca se muestra.
          </Typography.Paragraph>
          <Tabs
            activeKey={modo}
            onChange={(k) => {
              setModo(k as Modo);
              setError(undefined);
            }}
            items={[
              {
                key: "pkcs12",
                label: "Archivo .p12 / .pfx",
                children: (
                  <Form layout="vertical">
                    <Form.Item label="Archivo de la firma">
                      <Archivo
                        accept=".p12,.pfx"
                        archivo={p12}
                        onChange={setP12}
                        texto="Elegir archivo"
                      />
                    </Form.Item>
                    <Form.Item label="Contraseña del archivo">
                      <Input.Password
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Form.Item>
                  </Form>
                ),
              },
              {
                key: "pem",
                label: "Certificado y clave (PEM)",
                children: (
                  <Form layout="vertical">
                    <Form.Item label="Certificado">
                      <Archivo
                        accept=".pem,.crt,.cer"
                        archivo={certificado}
                        onChange={setCertificado}
                        texto="Elegir certificado"
                      />
                    </Form.Item>
                    <Form.Item label="Clave privada">
                      <Archivo
                        accept=".pem,.key"
                        archivo={clave}
                        onChange={setClave}
                        texto="Elegir clave"
                      />
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />
          {error && <Alert type="error" showIcon message={error} />}
        </Space>
      )}
    </Modal>
  );
}
