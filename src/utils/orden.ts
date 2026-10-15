/**
 * Orden de columnas de tablas con todos los datos en el navegador (antd: <Table.Column sorter={ordenar(...)} />).
 * Las tablas paginadas en la API se ordenan en la API (sorter: true y el orden va en la consulta).
 *
 * Los vacios (null, undefined, "") van al final en orden ascendente (antd invierte el resultado en descendente); los textos se comparan en espanol, sin distinguir mayusculas
 * ni acentos, y con los numeros dentro del texto en orden numerico (A-2 antes que A-10).
 */

type Valor = string | number | boolean | Date | null | undefined;

const colador = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function vacio(v: Valor): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

/** Compara dos valores: numeros y fechas por valor, booleanos (false antes que true) y textos con el colador */
export function comparar(a: Valor, b: Valor): number {
  if (vacio(a) || vacio(b)) return vacio(a) === vacio(b) ? 0 : vacio(a) ? 1 : -1;
  if (a instanceof Date || b instanceof Date) return new Date(a as Date).getTime() - new Date(b as Date).getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return colador.compare(String(a), String(b));
}

/**
 * Funcion de orden para una columna a partir del valor de cada fila. Para fechas que vienen como texto ISO
 * (yyyy-MM-dd...) alcanza con el texto; para otros formatos devolver un Date o un numero.
 */
export function ordenar<T>(valor: (fila: T) => Valor): (a: T, b: T) => number {
  return (a, b) => comparar(valor(a), valor(b));
}
