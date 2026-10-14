#!/usr/bin/env bash
# ==============================================================================
# SW Service Desk v1.0 - Procedimento de Cópia de Segurança Automatizado
# Organização: SW Cloud Solutions
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DEST:-/var/backups/sw-service-desk}"
ENV_FILE="${ENV_PATH:-/var/www/sw-service-desk/.env}"

mkdir -p "${BACKUP_DIR}"

if [ -f "${ENV_FILE}" ]; then
  # Carregar variáveis do .env
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

OUTPUT_TAR="${BACKUP_DIR}/backup_sw_servicedesk_${TIMESTAMP}.tar.gz"
TEMP_DIR=$(mktemp -d)

echo "==> [$(date)] A iniciar backup do SW Service Desk v1.0..."

# 1. Backup da Base de Dados
if [ "${DB_DIALECT:-mysql}" = "mysql" ] && command -v mysqldump &> /dev/null; then
  echo "==> A exportar MySQL/MariaDB (${DB_NAME})..."
  MYSQL_PWD="${DB_PASSWORD}" mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "${DB_NAME}" > "${TEMP_DIR}/database.sql"
elif [ -f "${SQLITE_PATH}" ]; then
  echo "==> A copiar ficheiro relacional SQLite de contingência..."
  cp "${SQLITE_PATH}" "${TEMP_DIR}/database.sqlite"
fi

# 2. Metadados e versão
cat <<EOF > "${TEMP_DIR}/backup_manifest.json"
{
  "system": "SW Service Desk v1.0",
  "organization": "SW Cloud Solutions",
  "backup_timestamp": "${TIMESTAMP}",
  "db_name": "${DB_NAME}",
  "db_dialect": "${DB_DIALECT:-mysql}"
}
EOF

# 3. Compactar ficheiro final com checksum SHA256
tar -czf "${OUTPUT_TAR}" -C "${TEMP_DIR}" .
rm -rf "${TEMP_DIR}"

sha256sum "${OUTPUT_TAR}" > "${OUTPUT_TAR}.sha256"

# 4. Rotação: manter últimos 30 dias
find "${BACKUP_DIR}" -type f -name "backup_sw_servicedesk_*.tar.gz" -mtime +30 -delete
find "${BACKUP_DIR}" -type f -name "backup_sw_servicedesk_*.sha256" -mtime +30 -delete

echo "==> [$(date)] Backup concluído com sucesso: ${OUTPUT_TAR}"
exit 0
