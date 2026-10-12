/** Lo que hace cada poller (por nombre de clase en la API) y su clave de activación en application.conf */
export const INFO: Record<
  string,
  {
    titulo: string;
    descripcion: string;
    config: string;
    link?: { to: string; texto: string };
  }
> = {
  ReporteDiarioPoller: {
    titulo: "Reporte diario a DGI",
    descripcion:
      "Genera los reportes diarios faltantes (no aceptados) de hace 30 a hace 11 días, para las empresas con firma digital.",
    config: "ReporteDiarioPoller.run",
    link: { to: "/reportes", texto: "Ver reportes" },
  },
  EmailEntrantesPoller: {
    titulo: "Emails recibidos",
    descripcion:
      "Lee las carpetas IMAP de las empresas y procesa los CFE que llegan por email.",
    config: "EmailEntrantesPoller.run",
  },
  PollerTipoDeCambioRunner: {
    titulo: "Cotizaciones (INE)",
    descripcion:
      "Descarga la cotización del dólar de INE y completa los días que faltan.",
    config: "TipoDeCambioPoller.run",
    link: { to: "/cotizaciones", texto: "Ver cotizaciones" },
  },
  NotificationPoller: {
    titulo: "Notificaciones",
    descripcion: "Envía las notificaciones pendientes a los usuarios.",
    config: "NotificationPoller.run",
  },
};
