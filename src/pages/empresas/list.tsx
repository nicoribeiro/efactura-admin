import { List, useTable } from "@refinedev/antd";
import { Table, Tag } from "antd";
import type { Empresa } from "../../contexts/empresa";

export function EmpresaList() {
  const { tableProps } = useTable<Empresa>({ resource: "empresas", syncWithLocation: false });

  return (
    <List title="Empresas">
      <Table {...tableProps} rowKey="rut" size="middle">
        <Table.Column dataIndex="rut" title="RUT" />
        <Table.Column dataIndex="razon" title="Razón social" />
        <Table.Column dataIndex="nombreComercial" title="Nombre comercial" />
        <Table.Column
          dataIndex="emisorElectronico"
          title="Emisor electrónico"
          render={(value: boolean) => (value ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>)}
        />
        <Table.Column dataIndex="mailRecepcion" title="Mail recepción" />
        <Table.Column dataIndex="hostRecepcion" title="Servidor IMAP" />
      </Table>
    </List>
  );
}
