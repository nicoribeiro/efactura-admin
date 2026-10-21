import type { I18nProvider } from "@refinedev/core";

/** Textos de Refine en español (solo las claves que usa la app; el resto cae al texto por defecto) */
const es: Record<string, string> = {
  "pages.login.title": "Ingresar",
  "pages.login.signin": "Ingresar",
  "pages.login.fields.email": "Email",
  "pages.login.fields.password": "Contraseña",
  "pages.login.errors.requiredEmail": "Ingrese el email",
  "pages.login.errors.validEmail": "Email inválido",
  "pages.login.errors.requiredPassword": "Ingrese la contraseña",
  "pages.error.404": "La página que busca no existe.",
  "pages.error.resource404": "La página que busca no existe.",
  "pages.error.backHome": "Volver al inicio",
  "buttons.refresh": "Actualizar",
  "buttons.show": "Ver",
  "buttons.list": "Listado",
  "buttons.logout": "Salir",
  "notifications.error": "Error (código: {{statusCode}})",
  "warnWhenUnsavedChanges": "¿Seguro que quiere salir? Hay cambios sin guardar.",
  "empresas.titles.list": "Empresas",
  "empresas.titles.show": "Empresa",
  "documentos.titles.list": "CFE",
  "documentos.titles.show": "CFE",
  "reportes.titles.list": "Reporte diario",
  "inicio.titles.list": "Inicio",
  "actions.list": "Listado",
  "actions.show": "Ver",
};

export const i18nProvider: I18nProvider = {
  translate: (key: string, options?: Record<string, unknown>, defaultMessage?: string) => {
    let text = es[key] ?? defaultMessage ?? key;
    if (options)
      for (const [name, value] of Object.entries(options)) text = text.replace(`{{${name}}}`, String(value));
    return text;
  },
  changeLocale: async () => {},
  getLocale: () => "es",
};
