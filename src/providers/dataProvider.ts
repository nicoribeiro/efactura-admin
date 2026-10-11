import type { BaseRecord, CrudFilter, DataProvider, GetListParams, GetOneParams } from "@refinedev/core";
import { API_URL, apiJson, type QueryParams } from "../api/http";

/** Respuesta paginada de la API (JSONUtils.createObjectList) */
interface ObjectList<T> {
  results: T[];
  count: number;
  page: number;
  pageSize: number;
}

/** La API limita pageSize a 50 en /documentos y a 100 en /empresa */
const MAX_PAGE_SIZE = 50;
const MAX_PAGE_SIZE_EMPRESAS = 100;

/**
 * Id compuesto de un documento: la API no tiene endpoint por id interno, se identifica por tipo, serie y numero.
 */
export const documentoId = (idTipoDoc: number, serie: string, nro: number) => `${idTipoDoc}|${serie}|${nro}`;

const parseDocumentoId = (id: string) => {
  const [idTipoDoc, serie, nro] = id.split("|");
  return { idTipoDoc: Number(idTipoDoc), serie, nro: Number(nro) };
};

/** Convierte filtros "eq" de Refine a query params. Fechas como epoch en segundos (lo que espera la API). */
function filtersToQuery(filters: CrudFilter[] | undefined): QueryParams {
  const query: QueryParams = {};
  for (const filter of filters ?? []) {
    if (!("field" in filter) || filter.value === undefined || filter.value === null || filter.value === "") continue;
    if (filter.field === "fecha" && Array.isArray(filter.value)) {
      const [from, to] = filter.value as [Date | string | undefined, Date | string | undefined];
      if (from) query.fromDate = Math.floor(new Date(from).getTime() / 1000);
      if (to) query.toDate = Math.floor(new Date(to).getTime() / 1000);
    } else {
      query[filter.field] = filter.value as string;
    }
  }
  return query;
}

function requireRut(meta: Record<string, unknown> | undefined): string {
  const rut = meta?.rut as string | undefined;
  if (!rut) throw { message: "Seleccione una empresa", statusCode: 400 };
  return rut;
}

/** El panel es de solo lectura: no se crean, modifican ni borran datos */
const notSupported = (operation: string) => () => {
  throw { message: `El panel es de solo lectura (${operation} no permitido)`, statusCode: 405 };
};

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, filters, meta }: GetListParams) => {
    const currentPage = pagination?.currentPage ?? 1;
    const pageSize = Math.min(pagination?.pageSize ?? 20, MAX_PAGE_SIZE);

    switch (resource) {
      case "empresas": {
        // Paginado en la API (filtros: q, emisorElectronico, conFirma). Nunca se pide la lista completa:
        // puede tener decenas de miles de empresas (lista de emisores de DGI).
        const size = Math.min(pagination?.pageSize ?? 20, MAX_PAGE_SIZE_EMPRESAS);
        const query = { ...filtersToQuery(filters), page: currentPage, pageSize: size };
        const list = await apiJson<ObjectList<BaseRecord>>("GET", "/empresa", query);
        return { data: list.results as TData[], total: list.count };
      }

      case "documentos": {
        const rut = requireRut(meta);
        const query = { ...filtersToQuery(filters), page: currentPage, pageSize };
        const list = await apiJson<ObjectList<BaseRecord>>("GET", `/empresa/${rut}/documentos`, query);
        return { data: list.results as TData[], total: list.count };
      }

      case "emails": {
        // Emails recibidos por la empresa (paginado en la API, maximo 50). Fechas: desde/hasta en segundos.
        const rut = requireRut(meta);
        const { fromDate, toDate, ...resto } = filtersToQuery(filters);
        const query = { ...resto, desde: fromDate, hasta: toDate, page: currentPage, pageSize };
        const list = await apiJson<ObjectList<BaseRecord>>("GET", `/empresa/${rut}/emails`, query);
        return { data: list.results as TData[], total: list.count };
      }

      case "sucursales": {
        // Sucursales de una empresa (pocas): la API devuelve la lista completa
        const rut = requireRut(meta);
        const sucursales = await apiJson<BaseRecord[]>("GET", `/empresa/${rut}/sucursales`);
        return { data: sucursales as TData[], total: sucursales.length };
      }

      case "caes": {
        // CAEs de una empresa (pocos): la API devuelve la lista completa
        const rut = requireRut(meta);
        const caes = await apiJson<BaseRecord[]>("GET", `/empresa/${rut}/cae`);
        return { data: caes as TData[], total: caes.length };
      }

      default:
        throw { message: `Recurso desconocido: ${resource}`, statusCode: 404 };
    }
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id, meta }: GetOneParams) => {
    switch (resource) {
      case "empresas":
        return { data: await apiJson<TData>("GET", `/empresa/${id}`) };

      case "documentos": {
        const rut = requireRut(meta);
        const { idTipoDoc, serie, nro } = parseDocumentoId(String(id));
        const list = await apiJson<ObjectList<TData>>("GET", `/empresa/${rut}/documentos`, {
          idTipoDoc,
          serie,
          nro,
          direccion: meta?.direccion as string | undefined,
          rutExterno: meta?.rutExterno as string | undefined,
        });
        return { data: list.results[0] };
      }

      default:
        throw { message: `Recurso desconocido: ${resource}`, statusCode: 404 };
    }
  },

  create: notSupported("create"),
  update: notSupported("update"),
  deleteOne: notSupported("delete"),
};
