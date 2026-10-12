import { Show } from "@refinedev/antd";
import { useOne } from "@refinedev/core";
import { Descriptions, Tabs, Tag } from "antd";
import { useParams, useSearchParams } from "react-router";
import { estadoFirma, formatFechaCorta } from "../../constants/firma";
import type { Empresa } from "../../contexts/empresa";
import { CaeTable } from "./caes";
import { EmailsTable } from "./emails";
import { SucursalesTable } from "./sucursales";
import { UsuariosTable } from "./usuarios";

export function EmpresaShow() {
  const { id: rut = "" } = useParams();
  // La pestaña va en la URL (?tab=cae) para poder enlazarla desde el tablero
  const [params, setParams] = useSearchParams();
  const { result: empresa, query } = useOne<Empresa & { sucursales?: Record<string, unknown>[] }>({
    resource: "empresas",
    id: rut,
  });

  return (
    <Show isLoading={query.isLoading} title={empresa ? `${empresa.rut} - ${empresa.razon ?? ""}` : "Empresa"}>
      {empresa && (
        <Tabs
          activeKey={params.get("tab") ?? "datos"}
          onChange={(tab) => setParams({ tab }, { replace: true })}
          items={[
            {
              key: "datos",
              label: "Datos",
              children: (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="RUT">{empresa.rut}</Descriptions.Item>
                  <Descriptions.Item label="Razón social">{empresa.razon}</Descriptions.Item>
                  <Descriptions.Item label="Nombre comercial">{empresa.nombreComercial}</Descriptions.Item>
                  <Descriptions.Item label="Emisor electrónico">
                    {empresa.emisorElectronico ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Resolución">{empresa.resolucion}</Descriptions.Item>
                  <Descriptions.Item label="Página web">{empresa.paginaWeb}</Descriptions.Item>
                  <Descriptions.Item label="Mail recepción">{empresa.mailRecepcion}</Descriptions.Item>
                  <Descriptions.Item label="Mail notificaciones">{empresa.mailNotificaciones}</Descriptions.Item>
                  <Descriptions.Item label="Servidor IMAP">
                    {empresa.hostRecepcion ? `${empresa.hostRecepcion}:${empresa.puertoRecepcion ?? ""}` : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Usuario IMAP">{empresa.userRecepcion}</Descriptions.Item>
                  <Descriptions.Item label="Firma digital">
                    <Tag color={estadoFirma(empresa.firmaDigital).color}>{estadoFirma(empresa.firmaDigital).label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Validez de la firma">
                    {empresa.firmaDigital
                      ? `${formatFechaCorta(empresa.firmaDigital.validaDesde)} al ${formatFechaCorta(empresa.firmaDigital.validaHasta)}`
                      : "-"}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: "sucursales",
              label: "Sucursales",
              children: <SucursalesTable rut={empresa.rut} />,
            },
            {
              key: "cae",
              label: "CAE",
              children: <CaeTable rut={empresa.rut} />,
            },
            {
              key: "emails",
              label: "Emails recibidos",
              children: <EmailsTable rut={empresa.rut} />,
            },
            {
              key: "usuarios",
              label: "Usuarios",
              children: <UsuariosTable rut={empresa.rut} />,
            },
          ]}
        />
      )}
    </Show>
  );
}
