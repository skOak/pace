#!/bin/bash
# ==========================================
# Pace Database Daily Backup Script
# ==========================================

# Database config
DB_NAME="pace_db"
DB_USER="pace_user"
# Provide the host and port if outside of localhost or docker
DB_HOST="localhost"
DB_PORT="5432"
# Set password inline for cron (or use PGPASSWORD env variable)
export PGPASSWORD="pace_password"

# Backup directory
BACKUP_DIR="/var/backups/pace_db"
mkdir -p "$BACKUP_DIR"

# Date format for the backup file
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"

echo "Starting backup for database: $DB_NAME"

# Perform backup and compress
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup successfully created at $BACKUP_FILE"
else
  echo "Backup failed!"
  exit 1
fi

# Clean up old backups (keep only latest 7 days)
echo "Cleaning old backups (older than 7 days)..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -type f -mtime +7 -exec rm {} \;

echo "Backup process finished."
