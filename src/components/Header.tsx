import { WarningOutlined } from "@ant-design/icons";
import { Layout, Select, Space, Tag, Tooltip, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { estadoFirma, formatFechaCorta } from "../constants/firma";
import { useEmpresa } from "../contexts/empresa";
import { BuscarComprobante } from "./BuscarComprobante";
import { ConsultarRut } from "./RutDgi";
import { MenuUsuario } from "./MenuUsuario";

export function Header() {
  const { opciones, empresa, setRut, buscar, loading } = useEmpresa();
  const [texto, setTexto] = useState("");
  const { token } = theme.useToken();

  // Busqueda en el servidor con un pequeño retardo para no consultar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => buscar(texto), 300);
    return () => clearTimeout(timer);
  }, [texto, buscar]);

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Space>
        <Typography.Text type="secondary">Empresa</Typography.Text>
        <Select
          style={{ minWidth: 360 }}
          loading={loading}
          value={empresa?.rut}
          onChange={(rut: string) => {
            setTexto("");
            setRut(rut);
          }}
          showSearch
          filterOption={false}
          onSearch={setTexto}
          placeholder="Buscar por RUT o razón social"
          notFoundContent={loading ? "Buscando..." : "Sin resultados"}
          options={opciones.map((e) => ({ value: e.rut, label: `${e.rut} - ${e.razon ?? e.nombreComercial ?? ""}` }))}
        />
        {empresa && estadoFirma(empresa.firmaDigital).alerta && (
          <Tooltip title={`Firma digital válida hasta ${formatFechaCorta(empresa.firmaDigital?.validaHasta)}`}>
            <Tag color={estadoFirma(empresa.firmaDigital).color}>
              <WarningOutlined /> Firma: {estadoFirma(empresa.firmaDigital).label}
            </Tag>
          </Tooltip>
        )}
      </Space>
      <Space>
        <BuscarComprobante />
        <ConsultarRut />
        <MenuUsuario />
      </Space>
    </Layout.Header>
  );
}
