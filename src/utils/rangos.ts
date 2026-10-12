import dayjs, { type Dayjs } from "dayjs";

export type Rango = [Dayjs, Dayjs];

/**
 * Rangos de fechas rapidos (botones y presets del calendario). Se calculan al momento para que "hoy" sea el dia
 * actual.
 */
export const rangosRapidos = (): { label: string; value: Rango }[] => {
  const hoy = dayjs().startOf("day");
  const mesAnterior = hoy.subtract(1, "month");
  return [
    { label: "Hoy", value: [hoy, hoy] },
    { label: "Última semana", value: [hoy.subtract(6, "day"), hoy] },
    { label: "Últimos 30 días", value: [hoy.subtract(29, "day"), hoy] },
    { label: "Este mes", value: [hoy.startOf("month"), hoy] },
    {
      label: "Mes anterior",
      value: [
        mesAnterior.startOf("month"),
        mesAnterior.endOf("month").startOf("day"),
      ],
    },
    { label: "Últimos 60 días", value: [hoy.subtract(59, "day"), hoy] },
  ];
};

/** Rango por defecto de los listados: ultimos 30 dias */
export const rangoPorDefecto = (): Rango => rangosRapidos()[2].value;

export const mismoRango = (a?: (Dayjs | null)[] | null, b?: Rango) =>
  !!a?.[0] &&
  !!a?.[1] &&
  !!b &&
  a[0].isSame(b[0], "day") &&
  a[1].isSame(b[1], "day");
