import { useList } from "@refinedev/core";
import { Alert, Table } from "antd";

/** Formato de SucursalSerializer (claves con mayúscula como en el JSON de entrada de la API) */
interface Sucursal {
  id: number;
  CdgDGISucur?: number | null;
  DomFiscal?: string | null;
  Ciudad?: string | null;
  Departamento?: string | null;
  CodigoPostal?: string | null;
  Telefono?: string | null;
}

/** Sucursales de una empresa (solo lectura) */
export function SucursalesTable({ rut }: { rut: string }) {
  const { result, query } = useList<Sucursal>({
    resource: "sucursales",
    meta: { rut },
    pagination: { mode: "off" },
  });

  if (query.isError)
    return <Alert type="error" showIcon message="No se pudieron obtener las sucursales" description={query.error?.message} />;

  const sucursales = [...(result?.data ?? [])].sort((a, b) => (a.CdgDGISucur ?? 0) - (b.CdgDGISucur ?? 0));

  return (
    <Table<Sucursal> dataSource={sucursales} loading={query.isLoading} rowKey="id" size="middle" pagination={false}>
      <Table.Column<Sucursal> title="Código DGI" dataIndex="CdgDGISucur" />
      <Table.Column<Sucursal> title="Domicilio fiscal" dataIndex="DomFiscal" />
      <Table.Column<Sucursal> title="Ciudad" dataIndex="Ciudad" />
      <Table.Column<Sucursal> title="Departamento" dataIndex="Departamento" />
      <Table.Column<Sucursal> title="Código postal" dataIndex="CodigoPostal" />
      <Table.Column<Sucursal> title="Teléfono" dataIndex="Telefono" />
    </Table>
  );
}
