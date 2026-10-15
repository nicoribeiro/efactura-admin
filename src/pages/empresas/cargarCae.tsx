import { InboxOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { apiJson } from "../../api/http";
import { TIPOS_DOC } from "../../constants/cfe";
import type { CAE } from "../../utils/cae";
import { leerCaeXml, type CaeDgi } from "../../utils/caeXml";
import { ordenar } from "../../utils/orden";

interface Archivo {
  nombre: string;
  cae?: CaeDgi;
  problemas: string[];
  resultado?: "cargado" | string;
}

/** Estado del archivo como se ve en la tabla (para ordenar por esa columna) */
const estadoArchivo = (a: Archivo) =>
  a.resultado === "cargado"
    ? "Cargado"
    : a.resultado
      ? "Error al cargar"
      : a.problemas.length > 0
        ? a.problemas[0]
        : "Listo para cargar";

/** Problemas que impedirian cargar el CAE (la API vuelve a validar todo) */
function problemas(
  cae: CaeDgi,
  rut: string,
  existentes: CAE[],
  otros: CaeDgi[],
): string[] {
  const p: string[] = [];
  if (cae.rucE !== rut) p.push(`Es de otra empresa (RUT ${cae.rucE})`);
  if (!TIPOS_DOC.some((t) => t.id === cae.tcfe))
    p.push(`Tipo de comprobante desconocido (${cae.tcfe})`);
  if (cae.dNro <= 0 || cae.hNro < cae.dNro) p.push("Rango inválido");
  const vence = dayjs(cae.fvd);
  if (!vence.isValid() || vence.isBefore(dayjs().add(8, "day"), "day"))
    p.push("Vencido o vence en menos de 8 días");
  if (existentes.some((e) => e.nro === cae.na)) p.push("Ya está cargado");
  const superpuesto = existentes.find(
    (e) =>
      e.idTipoDoc === cae.tcfe &&
      e.serie === cae.serie &&
      cae.dNro <= e.fin &&
      e.inicial <= cae.hNro,
  );
  if (superpuesto)
    p.push(
      `Se superpone con el CAE ${superpuesto.nro} (${superpuesto.inicial}-${superpuesto.fin})`,
    );
  if (otros.some((o) => o.na === cae.na))
    p.push("Repetido en los archivos elegidos");
  return p;
}

/**
 * Carga de CAE desde los XML que entrega DGI (solo ADMIN). Se leen en el navegador, se muestran para revisar y solo
 * se envian los que no tienen problemas (POST /empresa/:rut/cae, que valida de nuevo).
 */
export function CargarCae({
  rut,
  existentes,
  onCerrar,
  onCargados,
}: {
  rut: string;
  existentes: CAE[];
  onCerrar: () => void;
  onCargados: () => void;
}) {
  const { message } = App.useApp();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(false);

  const agregar = async (file: File) => {
    const texto = await file.text();
    const leido = leerCaeXml(texto);
    setArchivos((actuales) => {
      if ("error" in leido)
        return [...actuales, { nombre: file.name, problemas: [leido.error] }];
      const otros = actuales.flatMap((a) => (a.cae ? [a.cae] : []));
      return [
        ...actuales,
        {
          nombre: file.name,
          cae: leido,
          problemas: problemas(leido, rut, existentes, otros),
        },
      ];
    });
    return false; // no se sube: se lee aca
  };

  const validos = archivos.filter(
    (a) => a.cae && a.problemas.length === 0 && !a.resultado,
  );

  const cargar = async () => {
    setCargando(true);
    let cargados = 0;
    for (const a of validos) {
      const c = a.cae!;
      try {
        await apiJson("POST", `/empresa/${rut}/cae`, undefined, {
          RucE: c.rucE,
          TCFE: c.tcfe,
          Serie: c.serie,
          DNro: c.dNro,
          HNro: c.hNro,
          NA: c.na,
          FVD: c.fvd,
        });
        a.resultado = "cargado";
        cargados++;
      } catch (e) {
        a.resultado = (e as Error).message;
      }
      setArchivos((actuales) => [...actuales]);
    }
    setCargando(false);
    if (cargados > 0) {
      message.success(`${cargados} CAE cargado(s)`);
      onCargados();
    }
  };

  const tipo = (id: number) => TIPOS_DOC.find((t) => t.id === id);

  return (
    <Modal
      open
      width={900}
      title="Cargar CAE"
      onCancel={onCerrar}
      footer={
        <Space>
          <Button onClick={onCerrar}>Cerrar</Button>
          <Button
            type="primary"
            disabled={validos.length === 0}
            loading={cargando}
            onClick={cargar}
          >
            Cargar {validos.length > 0 ? `${validos.length} CAE` : ""}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Upload.Dragger
          accept=".xml,text/xml"
          multiple
          showUploadList={false}
          beforeUpload={agregar}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Arrastrá los XML de CAE que entrega DGI, o hacé clic para elegirlos
          </p>
          <p className="ant-upload-hint">
            Uno o varios. Se revisan antes de cargar.
          </p>
        </Upload.Dragger>

        {archivos.length > 0 && (
          <Table<Archivo>
            dataSource={archivos}
            rowKey={(a, i) => `${a.nombre}-${i}`}
            size="small"
            pagination={false}
            scroll={{ x: true }}
          >
            <Table.Column<Archivo>
              title="Archivo"
              sorter={ordenar<Archivo>((a) => a.nombre)}
              render={(_, a) => (
                <Typography.Text
                  style={{ fontSize: 12 }}
                  ellipsis={{ tooltip: a.nombre }}
                >
                  {a.nombre}
                </Typography.Text>
              )}
            />
            <Table.Column<Archivo>
              title="Tipo"
              sorter={ordenar<Archivo>((a) => a.cae?.tcfe)}
              render={(_, a) =>
                a.cae
                  ? `${a.cae.tcfe} - ${tipo(a.cae.tcfe)?.label ?? "?"}`
                  : "-"
              }
            />
            <Table.Column<Archivo>
              title="Serie"
              sorter={ordenar<Archivo>((a) => a.cae?.serie)}
              render={(_, a) => a.cae?.serie ?? "-"}
            />
            <Table.Column<Archivo>
              title="Rango"
              sorter={ordenar<Archivo>((a) => a.cae?.dNro)}
              render={(_, a) => (a.cae ? `${a.cae.dNro} - ${a.cae.hNro}` : "-")}
            />
            <Table.Column<Archivo>
              title="Nro. CAE"
              sorter={ordenar<Archivo>((a) => a.cae?.na)}
              render={(_, a) => a.cae?.na ?? "-"}
            />
            <Table.Column<Archivo>
              title="Vence"
              sorter={ordenar<Archivo>((a) => a.cae?.fvd)}
              render={(_, a) =>
                a.cae ? dayjs(a.cae.fvd).format("DD/MM/YYYY") : "-"
              }
            />
            <Table.Column<Archivo>
              title="Estado"
              sorter={ordenar<Archivo>(estadoArchivo)}
              render={(_, a) =>
                a.resultado === "cargado" ? (
                  <Tag color="green">Cargado</Tag>
                ) : a.resultado ? (
                  <Tooltip title={a.resultado}>
                    <Tag color="red">Error al cargar</Tag>
                  </Tooltip>
                ) : a.problemas.length > 0 ? (
                  <Tooltip title={a.problemas.join(". ")}>
                    <Tag color="orange">{a.problemas[0]}</Tag>
                  </Tooltip>
                ) : (
                  <Tag color="blue">Listo para cargar</Tag>
                )
              }
            />
          </Table>
        )}

        {archivos.some((a) => a.problemas.length > 0) && (
          <Alert
            type="warning"
            showIcon
            message="Los CAE con problemas no se cargan. Pasá el mouse sobre el estado para ver el detalle."
          />
        )}
      </Space>
    </Modal>
  );
}
