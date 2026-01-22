# Database Quick Reference

## 🚀 Quick Setup Commands

### One-Line Setup
```bash
# Make executable and run
chmod +x setup-database.sh && ./setup-database.sh
```

### Manual Setup
```bash
# 1. Create database
sudo -u postgres psql -c "CREATE DATABASE ai_builder;"

# 2. Execute schema
psql -U postgres -d ai_builder -f schema.sql

# 3. Done!
```

## 📊 Database Overview

### Tables by Category

**User Management (4)**
- `user`, `session`, `account`, `verification`

**Chat System (4)**
- `chat_thread`, `chat_message`, `chat_export`, `chat_export_comment`

**Builder IDE (5)**
- `builder_threads`, `builder_messages`, `builder_files`, `builder_commits`, `builder_deployments`

**Agent System (1)**
- `agent`

**MCP System (4)**
- `mcp_server`, `mcp_server_tool_custom_instructions`, `mcp_server_custom_instructions`, `mcp_oauth_session`

**Workflow System (3)**
- `workflow`, `workflow_node`, `workflow_edge`

**Other (7)**
- `bookmark`, `archive`, `archive_item`

**Total: 28 tables**

## 🔑 Connection Strings

### Local
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/ai_builder"
```

### Remote VPS
```bash
DATABASE_URL="postgresql://user:password@your-vps-ip:5432/ai_builder"
```

### With SSL
```bash
DATABASE_URL="postgresql://user:password@host:5432/ai_builder?sslmode=require"
```

## 🛠️ Common Commands

### Database Operations
```bash
# Connect to database
psql -U postgres -d ai_builder

# List tables
\dt

# Describe table
\d table_name

# Show table size
\dt+

# Exit
\q
```

### Backup & Restore
```bash
# Backup
pg_dump -U postgres ai_builder > backup.sql
pg_dump -U postgres ai_builder | gzip > backup.sql.gz

# Restore
psql -U postgres -d ai_builder < backup.sql
gunzip -c backup.sql.gz | psql -U postgres -d ai_builder
```

### User Management
```sql
-- Create user
CREATE USER myuser WITH PASSWORD 'mypassword';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ai_builder TO myuser;
GRANT ALL ON ALL TABLES IN SCHEMA public TO myuser;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO myuser;

-- Change password
ALTER USER myuser WITH PASSWORD 'newpassword';

-- Drop user
DROP USER myuser;
```

### Database Maintenance
```sql
-- Vacuum (cleanup)
VACUUM ANALYZE;

-- Reindex
REINDEX DATABASE ai_builder;

-- Check database size
SELECT pg_size_pretty(pg_database_size('ai_builder'));

-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔒 Security Checklist

- [ ] Change default admin password
- [ ] Use strong database password
- [ ] Enable SSL connections
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Limit remote access
- [ ] Use connection pooling
- [ ] Monitor slow queries

## 📈 Performance Tips

### PostgreSQL Configuration
```conf
# /etc/postgresql/14/main/postgresql.conf

# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Connections
max_connections = 100

# Logging
log_min_duration_statement = 1000
```

### Query Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM builder_threads WHERE user_id = 'xxx';

-- Update statistics
ANALYZE builder_threads;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

## 🐛 Troubleshooting

### Connection Issues
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check listening ports
sudo netstat -plnt | grep 5432

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Permission Issues
```sql
-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE ai_builder TO myuser;
GRANT ALL ON ALL TABLES IN SCHEMA public TO myuser;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO myuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO myuser;
```

### Reset Database
```bash
# ⚠️ WARNING: This deletes all data!
sudo -u postgres psql -c "DROP DATABASE ai_builder;"
sudo -u postgres psql -c "CREATE DATABASE ai_builder;"
psql -U postgres -d ai_builder -f schema.sql
```

## 📝 Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:pass@host:5432/ai_builder"

# Optional
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true
DATABASE_TIMEOUT=30000
```

## 🔄 Migration Commands

```bash
# Generate migration
npm run db:generate

# Push schema changes
npm run db:push

# Run migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

## 📊 Monitoring Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'ai_builder';

-- Long running queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 minutes';

-- Database statistics
SELECT * FROM pg_stat_database WHERE datname = 'ai_builder';

-- Table statistics
SELECT * FROM pg_stat_user_tables;

-- Index usage
SELECT * FROM pg_stat_user_indexes;
```

## 🎯 Quick Fixes

### "Database does not exist"
```bash
sudo -u postgres psql -c "CREATE DATABASE ai_builder;"
```

### "Role does not exist"
```bash
sudo -u postgres psql -c "CREATE USER myuser WITH PASSWORD 'mypass';"
```

### "Permission denied"
```bash
sudo -u postgres psql -d ai_builder -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;"
```

### "Too many connections"
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND state_change < now() - interval '1 hour';
```

## 📚 Resources

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Database Setup Guide](./DATABASE_SETUP_GUIDE.md)
- [Schema File](./schema.sql)

---

**Quick reference for database operations! 🚀**
