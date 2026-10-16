/// <reference types="vite/client" />

/** Version de package.json */
declare const __APP_VERSION__: string;
/** Commit del build (ver vite.config.ts) */
declare const __APP_COMMIT__: string;
/** Fecha del build en ISO, o null con npm run dev */
declare const __APP_BUILD__: string | null;
