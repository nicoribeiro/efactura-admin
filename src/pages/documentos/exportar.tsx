import { DownloadOutlined } from "@ant-design/icons";
import { useNotification, type CrudFilter } from "@refinedev/core";
import { App, Button } from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import {
  ESTADOS_CFE,
  tipoDocByName,
  type Direccion,
} from "../../constants/cfe";
import { dataProvider } from "../../providers/dataProvider";
import { aCsv, descargar, numeroCsv } from "../../utils/csv";
import type { Documento } from "./list";

/** Maximo de filas exportadas; se piden de a TAMANO_PAGINA, una pagina por vez para no cargar la API */
const LIMITE = 5000;
const TAMANO_PAGINA = 50;

const valorFiltro = (filters: CrudFilter[], campo: string) =>
  filters.find((f) => "field" in f && f.field === campo)?.value;

function filasCsv(docs: Documento[], direccion: Direccion) {
  const contraparte = direccion === "EMITIDO" ? "Receptor" : "Emisor";
  return [
    [
      "Tipo",
      "Código tipo",
      "Serie",
      "Número",
      "Fecha emisión",
      `RUT / documento ${contraparte.toLowerCase()}`,
      contraparte,
      "Moneda",
      "Total",
      "Estado DGI",
    ],
    ...docs.map((doc) => {
      const tipo = tipoDocByName(doc.tipo);
      const otra =
        direccion === "EMITIDO" ? doc.empresaReceptora : doc.empresaEmisora;
      return [
        tipo?.label ?? doc.tipo,
        tipo?.id,
        doc.serie,
        doc.nro,
        doc.fechaEmision
          ? dayjs(doc.fechaEmision.slice(0, 10)).format("DD/MM/YYYY")
          : "",
        otra?.rut ?? (direccion === "EMITIDO" ? doc.titular?.documento : ""),
        otra?.razon,
        doc.moneda,
        numeroCsv(doc.totMntTotal),
        doc.estado
          ? (ESTADOS_CFE[doc.estado]?.label ?? doc.estado)
          : "Sin respuesta",
      ];
    }),
  ];
}

/** Descarga en CSV los comprobantes del listado con los filtros aplicados */
export function ExportarCsv({
  rut,
  filters,
  total,
}: {
  rut: string;
  filters: CrudFilter[];
  total: number;
}) {
  const { modal } = App.useApp();
  const { open } = useNotification();
  const [progreso, setProgreso] = useState<number | null>(null);
  const activo = useRef(true);
  // Se marca al montar (no solo al crear la ref): en desarrollo React monta, desmonta y vuelve a montar
  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
    };
  }, []);

  const direccion = (valorFiltro(filters, "direccion") ??
    "EMITIDO") as Direccion;

  const exportar = async () => {
    const cantidad = Math.min(total, LIMITE);
    const docs: Documento[] = [];
    setProgreso(0);
    try {
      for (let pagina = 1; docs.length < cantidad; pagina++) {
        const { data } = await dataProvider.getList<Documento>({
          resource: "documentos",
          filters,
          pagination: { currentPage: pagina, pageSize: TAMANO_PAGINA },
          meta: { rut },
        });
        if (!activo.current) return;
        docs.push(...data);
        setProgreso(docs.length);
        if (data.length < TAMANO_PAGINA) break;
      }

      const fecha = valorFiltro(filters, "fecha") as
        (Date | string)[] | undefined;
      const periodo =
        fecha?.[0] && fecha?.[1]
          ? `_${dayjs(fecha[0]).format("YYYYMMDD")}-${dayjs(fecha[1]).format("YYYYMMDD")}`
          : "";
      descargar(
        `comprobantes-${direccion === "EMITIDO" ? "emitidos" : "recibidos"}_${rut}${periodo}.csv`,
        aCsv(filasCsv(docs.slice(0, cantidad), direccion)),
      );
    } catch (error) {
      open?.({
        type: "error",
        message: "No se pudo exportar",
        description: (error as Error).message,
      });
    } finally {
      if (activo.current) setProgreso(null);
    }
  };

  const confirmar = () => {
    if (total <= LIMITE) return exportar();
    modal.confirm({
      title: `Hay ${total.toLocaleString("es-UY")} comprobantes`,
      content: `Se exportan los primeros ${LIMITE.toLocaleString("es-UY")} (los más recientes). Para el resto, acotá el período.`,
      okText: "Exportar",
      cancelText: "Cancelar",
      onOk: () => {
        exportar();
      },
    });
  };

  return (
    <Button
      icon={<DownloadOutlined />}
      onClick={confirmar}
      loading={progreso !== null}
      disabled={total === 0}
    >
      {progreso !== null
        ? `Exportando ${progreso}/${Math.min(total, LIMITE)}`
        : "Exportar CSV"}
    </Button>
  );
}
