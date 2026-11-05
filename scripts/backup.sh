#!/usr/bin/env bash
# Консистентная резервная копия SQLite-базы.
# Использует команду .backup, поэтому копию можно делать на работающем сервисе.
#
# Переменные окружения:
#   DB_PATH     — путь к базе (по умолчанию ./data/vacations.db)
#   BACKUP_DIR  — каталог для копий (по умолчанию ./backups)
#   KEEP        — сколько последних копий хранить (по умолчанию 30)

set -euo pipefail

DB_PATH="${DB_PATH:-./data/vacations.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-30}"

if [ ! -f "$DB_PATH" ]; then
  echo "Файл базы не найден: $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Не найдена утилита sqlite3" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET="$BACKUP_DIR/vacations-$STAMP.db"

sqlite3 "$DB_PATH" ".backup '$TARGET'"
echo "Создана копия: $TARGET"

# Оставляем только KEEP самых свежих копий.
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/vacations-*.db 2>/dev/null | tail -n "+$((KEEP + 1))")
for file in ${OLD+"${OLD[@]}"}; do
  rm -f -- "$file"
  echo "Удалена старая копия: $file"
done

COUNT="$(ls -1 "$BACKUP_DIR"/vacations-*.db 2>/dev/null | wc -l)"
echo "Копий в каталоге: $COUNT (храним последние $KEEP)"
