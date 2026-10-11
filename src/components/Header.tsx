import { LogoutOutlined } from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Button, Layout, Select, Space, Typography } from "antd";
import { useEmpresa } from "../contexts/empresa";

export function Header() {
  const { empresas, empresa, setRut, loading } = useEmpresa();
  const { data: identity } = useGetIdentity<{ name: string }>();
  const { mutate: logout } = useLogout();

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "#fff",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <Space>
        <Typography.Text type="secondary">Empresa</Typography.Text>
        <Select
          style={{ minWidth: 320 }}
          loading={loading}
          value={empresa?.rut}
          onChange={setRut}
          showSearch
          optionFilterProp="label"
          options={empresas.map((e) => ({ value: e.rut, label: `${e.rut} - ${e.razon ?? e.nombreComercial ?? ""}` }))}
        />
      </Space>
      <Space>
        <Typography.Text>{identity?.name}</Typography.Text>
        <Button icon={<LogoutOutlined />} onClick={() => logout()}>
          Salir
        </Button>
      </Space>
    </Layout.Header>
  );
}
