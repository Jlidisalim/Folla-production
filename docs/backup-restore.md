# Database Backup & Restore Procedures

This document describes how to backup and restore the FOLLA PostgreSQL database.

## Prerequisites

- PostgreSQL client tools (`pg_dump`, `pg_restore`) installed
- Access to production database credentials
- Sufficient disk space for backups (estimate: 2x database size)

---

## Backup Procedure

### Manual Backup (One-time)

```bash
#!/bin/bash
# backup-database.sh

# Load production environment
export $(grep -v '^#' /path/to/.env | xargs)

# Variables
BACKUP_DIR="/var/backups/folla"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/folla_backup_${DATE}.dump"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup (custom format for flexibility)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --verbose \
  --file="$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
  echo "✅ Backup created: $BACKUP_FILE"
  echo "   Size: $(du -h $BACKUP_FILE | cut -f1)"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Keep only last 7 days of backups
find $BACKUP_DIR -name "folla_backup_*.dump" -mtime +7 -delete

echo "✅ Backup completed successfully"
```

### Automated Daily Backup (Cron)

Add to crontab (`crontab -e`):

```cron
# Daily backup at 3:00 AM
0 3 * * * /opt/folla/scripts/backup-database.sh >> /var/log/folla-backup.log 2>&1
```

### Cloud Backup (Recommended)

For production, use managed database backup:

**Railway**:
- Automatic daily backups included
- Access via Railway dashboard → Database → Backups

**Supabase/Neon**:
- Point-in-time recovery available
- Configure retention in dashboard

**AWS RDS**:
- Enable automated backups (35-day retention recommended)
- Snapshot before major changes

---

## Restore Procedure

### Step 1: Stop Application

```bash
# Docker
docker-compose stop backend

# Or systemd
sudo systemctl stop folla-backend
```

### Step 2: Create Restore Target Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create new database for restore test
CREATE DATABASE folla_restore_test;

# Or drop and recreate production (DANGEROUS - use with caution)
-- DROP DATABASE folla_prod;
-- CREATE DATABASE folla_prod;
```

### Step 3: Restore Backup

```bash
# Restore to test database first
pg_restore \
  --dbname=postgresql://user:password@localhost:5432/folla_restore_test \
  --verbose \
  --clean \
  --if-exists \
  /var/backups/folla/folla_backup_YYYYMMDD_HHMMSS.dump

# Verify row counts
psql -d folla_restore_test -c 'SELECT COUNT(*) FROM "Order";'
psql -d folla_restore_test -c 'SELECT COUNT(*) FROM "Product";'
```

### Step 4: Verify Data Integrity

```bash
# Connect and check
psql -d folla_restore_test

# Verify tables exist
\dt

# Check order counts
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FROM "Client";

# Check recent orders
SELECT id, status, "createdAt" FROM "Order" ORDER BY id DESC LIMIT 5;
```

### Step 5: Switch to Restored Database (if needed)

```bash
# Update .env to point to restored database
# (only if restoring to a different database name)

# Regenerate Prisma client
npx prisma generate

# Restart application
docker-compose start backend
# or
sudo systemctl start folla-backend
```

---

## Pre-Deployment Restore Test

**REQUIRED before production launch:**

1. Create a backup using the procedure above
2. Restore to a test database
3. Verify all tables have correct row counts
4. Start backend with test database
5. Hit `/health` endpoint - should return `ok`
6. Make a test query to `/products`
7. Drop test database when done

```bash
# Quick restore test script
#!/bin/bash
BACKUP_FILE="$1"
TEST_DB="folla_restore_test"

# Create test DB
createdb $TEST_DB

# Restore
pg_restore --dbname=$TEST_DB "$BACKUP_FILE"

# Verify
psql -d $TEST_DB -c 'SELECT COUNT(*) as orders FROM "Order";'
psql -d $TEST_DB -c 'SELECT COUNT(*) as products FROM "Product";'

# Cleanup
dropdb $TEST_DB

echo "✅ Restore test passed!"
```

---

## Emergency Recovery Contacts

- **Database Provider Support**: [Your provider's support link]
- **On-call Engineer**: [Your contact]

---

## Backup Checklist

- [ ] Backup script tested and working
- [ ] Cron job configured for daily backups
- [ ] Backup retention policy set (7+ days)
- [ ] Restore procedure tested successfully
- [ ] Off-site backup configured (optional but recommended)
- [ ] Monitoring alert for failed backups (optional)
