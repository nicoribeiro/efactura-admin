#!/bin/sh
# Antes de armar la config de Nginx (20-envsubst-on-templates.sh): sin API_UPSTREAM el proxy de /api/ quedaria roto
if [ -z "$API_UPSTREAM" ]; then
  echo "efactura-admin: falta API_UPSTREAM (URL de la API de java_efactura_uy, sin /api/v1, ej. http://<servidor-api>:9000)" >&2
  exit 1
fi
