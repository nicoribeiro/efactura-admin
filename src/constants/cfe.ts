/** Tipos de CFE: espejo de com.bluedot.efactura.model.TipoDoc */
export const TIPOS_DOC: { id: number; name: string; label: string }[] = [
  { id: 101, name: "eTicket", label: "eTicket" },
  { id: 102, name: "Nota_de_Credito_de_eTicket", label: "NC eTicket" },
  { id: 103, name: "Nota_de_Debito_de_eTicket", label: "ND eTicket" },
  { id: 111, name: "eFactura", label: "eFactura" },
  { id: 112, name: "Nota_de_Credito_de_eFactura", label: "NC eFactura" },
  { id: 113, name: "Nota_de_Debito_de_eFactura", label: "ND eFactura" },
  { id: 121, name: "eFactura_Exportacion", label: "eFactura Exportación" },
  {
    id: 122,
    name: "Nota_de_Credito_de_eFactura_Exportacion",
    label: "NC eFactura Exportación",
  },
  {
    id: 123,
    name: "Nota_de_Debito_de_eFactura_Exportacion",
    label: "ND eFactura Exportación",
  },
  { id: 124, name: "eRemito_de_Exportacion", label: "eRemito Exportación" },
  {
    id: 131,
    name: "eTicket_Venta_por_Cuenta_Ajena",
    label: "eTicket Cta. Ajena",
  },
  {
    id: 132,
    name: "Nota_de_Credito_de_eTicket_Venta_por_Cuenta_Ajena",
    label: "NC eTicket Cta. Ajena",
  },
  {
    id: 133,
    name: "Nota_de_Debito_de_eTicket_Venta_por_Cuenta_Ajena",
    label: "ND eTicket Cta. Ajena",
  },
  {
    id: 141,
    name: "eFactura_Venta_por_Cuenta_Ajena",
    label: "eFactura Cta. Ajena",
  },
  {
    id: 142,
    name: "Nota_de_Credito_de_eFactura_Venta_por_Cuenta_Ajena",
    label: "NC eFactura Cta. Ajena",
  },
  {
    id: 143,
    name: "Nota_de_Debito_de_eFactura_Venta_por_Cuenta_Ajena",
    label: "ND eFactura Cta. Ajena",
  },
  { id: 181, name: "eRemito", label: "eRemito" },
  { id: 182, name: "eResguardo", label: "eResguardo" },
  { id: 201, name: "eTicket_Contingencia", label: "eTicket Contingencia" },
  {
    id: 202,
    name: "Nota_de_Credito_de_eTicket_Contingencia",
    label: "NC eTicket Contingencia",
  },
  {
    id: 203,
    name: "Nota_de_Debito_de_eTicket_Contingencia",
    label: "ND eTicket Contingencia",
  },
  { id: 211, name: "eFactura_Contingencia", label: "eFactura Contingencia" },
  {
    id: 212,
    name: "Nota_de_Credito_de_eFactura_Contingencia",
    label: "NC eFactura Contingencia",
  },
  {
    id: 213,
    name: "Nota_de_Debito_de_eFactura_Contingencia",
    label: "ND eFactura Contingencia",
  },
  {
    id: 221,
    name: "eFactura_Exportacion_Contingencia",
    label: "eFactura Exportación Contingencia",
  },
  {
    id: 222,
    name: "Nota_de_Credito_de_eFactura_Exportacion_Contingencia",
    label: "NC eFactura Exportación Contingencia",
  },
  {
    id: 223,
    name: "Nota_de_Debito_de_eFactura_Exportacion_Contingencia",
    label: "ND eFactura Exportación Contingencia",
  },
  {
    id: 224,
    name: "eRemito_de_Exportacion_Contingencia",
    label: "eRemito Exportación Contingencia",
  },
  {
    id: 231,
    name: "eTicket_Venta_por_Cuenta_Ajena_Contingencia",
    label: "eTicket Cta. Ajena Contingencia",
  },
  {
    id: 241,
    name: "eFactura_Venta_por_Cuenta_Ajena_Contingencia",
    label: "eFactura Cta. Ajena Contingencia",
  },
  { id: 281, name: "eRemito_Contingencia", label: "eRemito Contingencia" },
  {
    id: 282,
    name: "eResguardo_Contingencia",
    label: "eResguardo Contingencia",
  },
];

export const tipoDocByName = (name?: string) =>
  TIPOS_DOC.find((t) => t.name === name);

/** Estados de respuesta DGI de un CFE (EstadoACKCFEType) */
export const ESTADOS_CFE: Record<string, { label: string; color: string }> = {
  AE: { label: "Aceptado", color: "green" },
  BE: { label: "Rechazado", color: "red" },
  CE: { label: "Observado", color: "orange" },
};

/** Estados de la respuesta de DGI para filtrar el listado (SIN = sin respuesta) */
export const ESTADOS_FILTRO = [
  { value: "AE", label: "Aceptado" },
  { value: "BE", label: "Rechazado" },
  { value: "CE", label: "Observado" },
  { value: "SIN", label: "Sin respuesta" },
];

export type Direccion = "EMITIDO" | "RECIBIDO";

/** Fecha sin hora (DD/MM/YYYY), para las que la API guarda como dia: emision de comprobantes, sobres, CAE */
export const formatFechaDia = (value?: string | null) =>
  value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : "";

/** Las fechas de la API vienen como "yyyy-MM-dd HH:mm:ss z"; se muestra sin la zona */
export const formatFechaApi = (value?: string | null) =>
  value ? value.slice(0, 19) : "";
