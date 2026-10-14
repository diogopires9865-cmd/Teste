#!/usr/bin/env bash
# ==============================================================================
# SW Service Desk v1.0 - Procedimento de Recuperação de Emergência
# Organização: SW Cloud Solutions
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 <caminho_do_arquivo_tar_gz>"
  exit 1
fi

BACKUP_ARCHIVE="$1"
ENV_FILE="${ENV_PATH:-/var/www/sw-service-desk/.env}"

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
  echo "Erro: Ficheiro de backup não encontrado em: ${BACKUP_ARCHIVE}"
  exit 1
fi

echo "==> A validar checksum SHA256 do arquivo..."
if [ -f "${BACKUP_ARCHIVE}.sha256" ]; then
  sha256sum -c "${BACKUP_ARCHIVE}.sha256"
  echo "==> Checksum verificado com sucesso."
else
  echo "Aviso: Ficheiro de checksum .sha256 não encontrado. Prosseguindo com cautela..."
fi

if [ -f "${ENV_FILE}" ]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-sw_desk_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-sw_servicedesk}"
SQLITE_PATH="${DB_SQLITE_PATH:-./data/sw_servicedesk.sqlite}"

TEMP_RESTORE_DIR=$(mktemp -d)
tar -xzf "${BACKUP_ARCHIVE}" -C "${TEMP_RESTORE_DIR}"

if [ -f "${TEMP_RESTORE_DIR}/database.sql" ]; then
  echo "==> A restaurar base de dados MySQL/MariaDB (${DB_NAME})..."
  MYSQL_PWD="${DB_PASSWORD}" mysql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    "${DB_NAME}" < "${TEMP_RESTORE_DIR}/database.sql"
  echo "==> Base de dados restaurada com sucesso!"
elif [ -f "${TEMP_RESTORE_DIR}/database.sqlite" ]; then
  echo "==> A restaurar ficheiro SQLite..."
  mkdir -p "$(dirname "${SQLITE_PATH}")"
  cp "${TEMP_RESTORE_DIR}/database.sqlite" "${SQLITE_PATH}"
  echo "==> Ficheiro SQLite restaurado com sucesso!"
fi

rm -rf "${TEMP_RESTORE_DIR}"
echo "==> Procedimento de recuperação concluído com sucesso."
exit 0
