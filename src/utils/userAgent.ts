/** "Chrome 141 · macOS" a partir del User-Agent; para clientes que no son navegadores, su primer token (ej. curl/8.4) */
export function navegador(ua?: string | null): string {
  if (!ua) return "-";
  const version = (re: RegExp) => ua.match(re)?.[1]?.split(".")[0];
  const browser =
    (version(/Edg\/([\d.]+)/) && `Edge ${version(/Edg\/([\d.]+)/)}`) ||
    (version(/OPR\/([\d.]+)/) && `Opera ${version(/OPR\/([\d.]+)/)}`) ||
    (version(/Firefox\/([\d.]+)/) &&
      `Firefox ${version(/Firefox\/([\d.]+)/)}`) ||
    (version(/Chrome\/([\d.]+)/) && `Chrome ${version(/Chrome\/([\d.]+)/)}`) ||
    (/Safari\//.test(ua) &&
      version(/Version\/([\d.]+)/) &&
      `Safari ${version(/Version\/([\d.]+)/)}`) ||
    undefined;
  const so = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : undefined;
  if (browser) return so ? `${browser} · ${so}` : browser;
  return ua.split(" ")[0];
}
