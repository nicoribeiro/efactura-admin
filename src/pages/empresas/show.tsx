import { Show } from "@refinedev/antd";
import { useOne } from "@refinedev/core";
import { Descriptions, Tabs, Tag } from "antd";
import { useParams } from "react-router";
import type { Empresa } from "../../contexts/empresa";
import { CaeTable } from "./caes";
import { EmailsTable } from "./emails";

export function EmpresaShow() {
  const { id: rut = "" } = useParams();
  const { result: empresa, query } = useOne<Empresa & { sucursales?: Record<string, unknown>[] }>({
    resource: "empresas",
    id: rut,
  });

  return (
    <Show isLoading={query.isLoading} title={empresa ? `${empresa.rut} - ${empresa.razon ?? ""}` : "Empresa"}>
      {empresa && (
        <Tabs
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
                </Descriptions>
              ),
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
          ]}
        />
      )}
    </Show>
  );
}
