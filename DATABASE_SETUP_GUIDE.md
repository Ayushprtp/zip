# Database Setup Guide

## 🗄️ Complete Database Setup for New VPS

This guide will help you set up the complete database schema on a fresh PostgreSQL installation.

## Prerequisites

- PostgreSQL 14 or higher
- Access to PostgreSQL with superuser privileges
- `psql` command-line tool

## Quick Setup (5 Minutes)

### 1. Install PostgreSQL (if not already installed)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**CentOS/RHEL:**
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

### 2. Create Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE ai_builder;

# Create user (optional, for security)
CREATE USER ai_builder_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ai_builder TO ai_builder_user;

# Exit
\q
```

### 3. Execute Schema

**Option A: Using psql**
```bash
psql -U postgres -d ai_builder -f schema.sql
```

**Option B: Using specific user**
```bash
psql -U ai_builder_user -d ai_builder -f schema.sql
```

**Option C: Remote database**
```bash
psql -h your-vps-ip -U postgres -d ai_builder -f schema.sql
```

### 4. Verify Installation

```bash
psql -U postgres -d ai_builder

# List all tables
\dt

# Check table count (should be 28)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

# Exit
\q
```

## What Gets Created

### Tables (28 total)

**User Management (4 tables):**
- `user` - User accounts
- `session` - User sessions
- `account` - OAuth accounts
- `verification` - Email verification

**Chat System (4 tables):**
- `chat_thread` - Chat conversations
- `chat_message` - Chat messages
- `chat_export` - Exported chats
- `chat_export_comment` - Comments on exports

**Agent System (1 table):**
- `agent` - AI agents

**MCP System (4 tables):**
- `mcp_server` - MCP servers
- `mcp_server_tool_custom_instructions` - Tool customizations
- `mcp_server_custom_instructions` - Server customizations
- `mcp_oauth_session` - OAuth sessions

**Workflow System (3 tables):**
- `workflow` - Workflows
- `workflow_node` - Workflow nodes
- `workflow_edge` - Workflow edges

**Builder System (5 tables):**
- `builder_threads` - Builder projects
- `builder_messages` - Builder chat
- `builder_files` - Project files
- `builder_commits` - Git commits
- `builder_deployments` - Vercel deployments

**Bookmark & Archive (3 tables):**
- `bookmark` - User bookmarks
- `archive` - Archives
- `archive_item` - Archive items

### Indexes (30+)

All tables have appropriate indexes for:
- Primary keys
- Foreign keys
- Frequently queried columns
- Performance optimization

### Triggers (8)

Automatic `updated_at` timestamp updates for:
- user
- session
- account
- agent
- mcp_server
- workflow
- builder_threads
- builder_files

## Default Admin Account

**⚠️ IMPORTANT: Change these credentials immediately!**

```
Email: admin@example.com
Password: admin123
Role: super_admin
```

### Change Admin Password

```sql
-- Connect to database
psql -U postgres -d ai_builder

-- Update password (use bcrypt hash)
UPDATE "user" 
SET password = '$2a$10$YOUR_NEW_BCRYPT_HASH'
WHERE email = 'admin@example.com';

-- Or update email
UPDATE "user" 
SET email = 'your-email@example.com'
WHERE email = 'admin@example.com';
```

## Environment Configuration

After database setup, configure your `.env`:

```bash
# Database
DATABASE_URL="postgresql://ai_builder_user:your_password@localhost:5432/ai_builder"

# Or for remote database
DATABASE_URL="postgresql://ai_builder_user:your_password@your-vps-ip:5432/ai_builder"

# Connection pool (optional)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Security Best Practices

### 1. Secure PostgreSQL

Edit `/etc/postgresql/14/main/postgresql.conf`:
```conf
# Listen on specific IP only
listen_addresses = 'localhost'  # or your VPS IP

# Enable SSL
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

Edit `/etc/postgresql/14/main/pg_hba.conf`:
```conf
# Require password authentication
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# For remote access (use SSL)
hostssl ai_builder      ai_builder_user your-app-ip/32         md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 2. Firewall Configuration

```bash
# Allow PostgreSQL only from your app server
sudo ufw allow from your-app-ip to any port 5432

# Or for local only
sudo ufw deny 5432
```

### 3. Regular Backups

```bash
# Create backup script
cat > /usr/local/bin/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U postgres ai_builder | gzip > $BACKUP_DIR/ai_builder_$DATE.sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-db.sh" | sudo crontab -
```

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if listening on correct port
sudo netstat -plnt | grep 5432

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Permission Denied

```bash
# Grant all privileges
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE ai_builder TO ai_builder_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ai_builder_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ai_builder_user;
```

### Schema Already Exists

```bash
# Drop and recreate (⚠️ WARNING: This deletes all data!)
sudo -u postgres psql
DROP DATABASE ai_builder;
CREATE DATABASE ai_builder;
\q

# Then run schema.sql again
psql -U postgres -d ai_builder -f schema.sql
```

### Extension Not Found

```bash
# Install PostgreSQL contrib package
sudo apt install postgresql-contrib

# Then in psql:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

## Verification Checklist

- [ ] PostgreSQL installed and running
- [ ] Database created
- [ ] Schema executed successfully
- [ ] All 28 tables created
- [ ] All indexes created
- [ ] All triggers created
- [ ] Default admin account exists
- [ ] Admin password changed
- [ ] Environment variables configured
- [ ] Connection from app works
- [ ] Backup script configured

## Migration from Existing Database

If you have an existing database and want to migrate:

```bash
# Export data from old database
pg_dump -U postgres old_database > old_data.sql

# Create new database with schema
psql -U postgres -d ai_builder -f schema.sql

# Import data (may need adjustments)
psql -U postgres -d ai_builder -f old_data.sql
```

## Performance Tuning

For production, tune PostgreSQL settings in `postgresql.conf`:

```conf
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Connections
max_connections = 100

# Logging
log_min_duration_statement = 1000  # Log slow queries
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

## Monitoring

```bash
# Check database size
psql -U postgres -d ai_builder -c "SELECT pg_size_pretty(pg_database_size('ai_builder'));"

# Check table sizes
psql -U postgres -d ai_builder -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check active connections
psql -U postgres -d ai_builder -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ai_builder';"
```

## Next Steps

1. ✅ Database setup complete
2. Configure your application's `.env` file
3. Test database connection from your app
4. Create your first user account
5. Start building!

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify connection settings
3. Ensure all extensions are installed
4. Check firewall rules
5. Review this guide's troubleshooting section

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

**Database setup complete! Your AI Builder is ready to go! 🚀**
