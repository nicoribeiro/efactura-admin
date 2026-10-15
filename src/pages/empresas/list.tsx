import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import type { CrudFilters } from "@refinedev/core";
import { Button, Card, Checkbox, Form, Input, Table, Tag } from "antd";
import { useNavigate } from "react-router";
import { estadoFirma } from "../../constants/firma";
import type { Empresa } from "../../contexts/empresa";

interface FiltrosForm {
  q?: string;
  conFirma?: boolean;
}

export function EmpresaList() {
  const navigate = useNavigate();
  const ver = (empresa: Empresa) => navigate(`/empresas/show/${encodeURIComponent(empresa.rut)}`);

  const { tableProps, searchFormProps } = useTable<Empresa, never, FiltrosForm>({
    resource: "empresas",
    syncWithLocation: false,
    pagination: { pageSize: 20 },
    filters: { initial: [{ field: "conFirma", operator: "eq", value: "true" }] },
    onSearch: (values): CrudFilters => [
      { field: "q", operator: "eq", value: values.q?.trim() || undefined },
      { field: "conFirma", operator: "eq", value: values.conFirma ? "true" : undefined },
    ],
  });

  return (
    <List title="Empresas">
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form {...searchFormProps} layout="inline" initialValues={{ conFirma: true }}>
          <Form.Item name="q" label="Buscar">
            <Input allowClear placeholder="RUT, razón social o nombre comercial" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="conFirma" valuePropName="checked">
            <Checkbox>Solo con firma digital</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              Buscar
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Table {...tableProps} rowKey="rut" size="middle" onRow={(empresa) => ({ onDoubleClick: () => ver(empresa) })}>
        <Table.Column dataIndex="rut" title="RUT" sorter />
        <Table.Column<Empresa>
          dataIndex="razon"
          title="Razón social"
          sorter
          render={(razon: string, empresa) => (
            <>
              {razon}
              {empresa.activa === false && (
                <Tag color="red" style={{ marginLeft: 8 }}>
                  De baja
                </Tag>
              )}
            </>
          )}
        />
        <Table.Column dataIndex="nombreComercial" title="Nombre comercial" sorter />
        <Table.Column
          dataIndex="emisorElectronico"
          title="Emisor electrónico"
          sorter
          render={(value: boolean) => (value ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>)}
        />
        <Table.Column<Empresa>
          title="Firma digital"
          // Orden en la API por vencimiento de la firma; dataIndex solo da el nombre del orden
          dataIndex="firma"
          sorter
          render={(_, empresa) => {
            const estado = estadoFirma(empresa.firmaDigital);
            return <Tag color={estado.color}>{estado.label}</Tag>;
          }}
        />
        <Table.Column dataIndex="mailRecepcion" title="Mail recepción" sorter />
        <Table.Column dataIndex="hostRecepcion" title="Servidor IMAP" sorter />
        <Table.Column<Empresa>
          title=""
          render={(_, empresa) => <Button size="small" icon={<EyeOutlined />} onClick={() => ver(empresa)} />}
        />
      </Table>
    </List>
  );
}
