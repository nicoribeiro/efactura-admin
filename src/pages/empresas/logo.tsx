import { UploadOutlined } from "@ant-design/icons";
import { App, Button, Space, Typography, Upload } from "antd";
import { useEffect, useState } from "react";
import { apiBlob, apiJson } from "../../api/http";
import { aBase64 } from "../../utils/archivos";

const MAX_LOGO = 512 * 1024;

/** Logo de la empresa (el que va en los PDF) y, para ADMIN, el boton para cambiarlo */
export function LogoEmpresa({
  rut,
  tieneLogo,
  esAdmin,
  onCambiado,
}: {
  rut: string;
  tieneLogo?: boolean;
  esAdmin: boolean;
  onCambiado: () => void;
}) {
  const { message } = App.useApp();
  const [url, setUrl] = useState<string>();
  const [subiendo, setSubiendo] = useState(false);
  // Se incrementa al subir un logo nuevo para volver a pedirlo
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!tieneLogo) {
      setUrl(undefined);
      return;
    }
    let cancelado = false;
    let objeto: string | undefined;
    apiBlob(`/empresa/${rut}/logo`)
      .then((blob) => {
        if (cancelado) return;
        objeto = URL.createObjectURL(blob);
        setUrl(objeto);
      })
      .catch(() => !cancelado && setUrl(undefined));
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [rut, tieneLogo, version]);

  const subir = async (archivo: File) => {
    if (!["image/png", "image/jpeg"].includes(archivo.type)) {
      message.error("El logo tiene que ser PNG o JPEG");
      return;
    }
    if (archivo.size > MAX_LOGO) {
      message.error("El logo no puede superar los 512 KB");
      return;
    }
    setSubiendo(true);
    try {
      await apiJson("PUT", `/empresa/${rut}`, undefined, {
        logo: await aBase64(archivo),
      });
      message.success("Logo actualizado");
      setVersion((v) => v + 1);
      onCambiado();
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Space align="center" size="middle" wrap>
      {url ? (
        <img
          src={url}
          alt="Logo de la empresa"
          style={{
            maxHeight: 64,
            maxWidth: 220,
            background: "#fff",
            padding: 4,
            borderRadius: 4,
          }}
        />
      ) : (
        <Typography.Text type="secondary">Sin logo</Typography.Text>
      )}
      {esAdmin && (
        <Upload
          accept="image/png,image/jpeg"
          showUploadList={false}
          beforeUpload={(archivo) => {
            subir(archivo);
            return false;
          }}
        >
          <Button size="small" icon={<UploadOutlined />} loading={subiendo}>
            {url ? "Cambiar logo" : "Subir logo"}
          </Button>
        </Upload>
      )}
    </Space>
  );
}
