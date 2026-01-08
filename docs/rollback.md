# Rollback Strategy

This document describes how to roll back the FOLLA application after a failed deployment.

---

## Types of Rollback

### 1. Application Rollback (No DB Changes)

If the new code has bugs but database schema is unchanged:

```bash
# Docker: Roll back to previous image
docker-compose pull backend:previous-tag
docker-compose up -d backend

# Or with Git:
cd /opt/folla/backend
git checkout HEAD~1  # Go back one commit
npm ci
npm run build
pm2 restart folla-backend
```

### 2. Database Migration Rollback

**⚠️ WARNING**: Prisma does not have built-in migration rollback. Plan carefully!

#### Before Any Migration

```bash
# ALWAYS backup before migrating
./scripts/backup-database.sh

# Record the current migration state
npx prisma migrate status > migration_state_before.txt
```

#### If Migration Fails Mid-way

```bash
# Check current state
npx prisma migrate status

# Resolve failed migration (creates draft)
npx prisma migrate resolve --rolled-back "migration_name"

# Or mark as applied if it partially succeeded
npx prisma migrate resolve --applied "migration_name"
```

#### Full Database Rollback

If a migration corrupted data:

```bash
# 1. Stop backend
docker-compose stop backend

# 2. Restore from backup
pg_restore \
  --dbname=$DATABASE_URL \
  --clean \
  --if-exists \
  /var/backups/folla/folla_backup_BEFORE_MIGRATION.dump

# 3. Reset migration history to match backup
npx prisma migrate resolve --rolled-back "failed_migration_name"

# 4. Roll back application code
git checkout previous-commit-hash

# 5. Rebuild and restart
npm run build
docker-compose up -d backend
```

---

## Deployment Checklist (Rollback-Ready)

Before every deployment:

- [ ] Database backup completed and verified
- [ ] Current Git commit hash recorded: `________`
- [ ] Current Docker image tag recorded: `________`
- [ ] Migration state saved: `npx prisma migrate status`
- [ ] Rollback command prepared (see below)

### Quick Rollback Commands

```bash
# Application rollback (no DB changes)
git checkout PREVIOUS_COMMIT
npm ci && npm run build
docker-compose up -d --build backend

# Full rollback (with DB restore)
./scripts/restore-database.sh /var/backups/folla/BACKUP_FILE.dump
git checkout PREVIOUS_COMMIT
npm ci && npm run build
docker-compose up -d --build backend
```

---

## Zero-Downtime Deployment (Blue-Green)

For critical deployments, use blue-green strategy:

1. **Blue** = Current production (keep running)
2. **Green** = New version (deploy to separate container)

```yaml
# docker-compose.yml snippet
services:
  backend-blue:
    image: folla-backend:current
    ports:
      - "4000:4000"
  
  backend-green:
    image: folla-backend:new
    ports:
      - "4001:4000"
```

Test green on port 4001, then switch nginx to green.

---

## Rollback Decision Matrix

| Symptom | Action |
|---------|--------|
| 500 errors, DB queries work | Roll back app code only |
| 500 errors, DB queries fail | Check migrations, possibly restore DB |
| Missing data after migration | Restore from backup |
| Performance degraded | Roll back app + check new queries |
| Auth not working | Check Clerk keys, roll back if needed |
| Payments failing | Check Paymee config, roll back if critical |

---

## Post-Rollback Actions

After any rollback:

1. [ ] Verify `/health` returns `ok`
2. [ ] Test critical flows (browse, cart, checkout)
3. [ ] Check logs for errors: `docker-compose logs backend --tail=100`
4. [ ] Notify team of rollback
5. [ ] Create post-mortem document
6. [ ] Fix issues in development before re-deploying
