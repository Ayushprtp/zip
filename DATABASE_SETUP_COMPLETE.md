# Database Setup - Complete Package

## 🎉 Everything You Need to Set Up Your Database

I've created a complete database setup package for deploying on a new VPS or machine.

## 📦 What's Included

### 1. **schema.sql** - Complete Database Schema
- All 28 tables with proper structure
- All indexes for performance
- All foreign key relationships
- All triggers for auto-updates
- Default admin account
- Ready to execute on any PostgreSQL database

### 2. **setup-database.sh** - Automated Setup Script
- Interactive setup wizard
- Creates database and user
- Executes schema automatically
- Verifies installation
- Adds to .env file
- Handles errors gracefully

### 3. **DATABASE_SETUP_GUIDE.md** - Complete Documentation
- Step-by-step installation guide
- Security best practices
- Troubleshooting section
- Performance tuning tips
- Backup configuration
- Monitoring queries

### 4. **DATABASE_QUICK_REFERENCE.md** - Quick Reference Card
- Common commands
- Connection strings
- Backup/restore commands
- Troubleshooting quick fixes
- Performance tips

## 🚀 Quick Start (Choose One Method)

### Method 1: Automated Setup (Recommended)
```bash
# Make executable and run
chmod +x setup-database.sh
./setup-database.sh

# Follow the prompts
# Done! ✅
```

### Method 2: Manual Setup
```bash
# 1. Create database
sudo -u postgres psql -c "CREATE DATABASE ai_builder;"

# 2. Execute schema
psql -U postgres -d ai_builder -f schema.sql

# 3. Add to .env
echo 'DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_builder"' >> .env

# Done! ✅
```

### Method 3: Remote VPS
```bash
# Upload files to VPS
scp schema.sql setup-database.sh user@your-vps:/path/

# SSH to VPS
ssh user@your-vps

# Run setup
cd /path/
chmod +x setup-database.sh
./setup-database.sh

# Done! ✅
```

## 📊 What Gets Created

### Database Structure

```
ai_builder (database)
├── User Management (4 tables)
│   ├── user
│   ├── session
│   ├── account
│   └── verification
│
├── Chat System (4 tables)
│   ├── chat_thread
│   ├── chat_message
│   ├── chat_export
│   └── chat_export_comment
│
├── Builder IDE (5 tables)
│   ├── builder_threads
│   ├── builder_messages
│   ├── builder_files
│   ├── builder_commits
│   └── builder_deployments
│
├── Agent System (1 table)
│   └── agent
│
├── MCP System (4 tables)
│   ├── mcp_server
│   ├── mcp_server_tool_custom_instructions
│   ├── mcp_server_custom_instructions
│   └── mcp_oauth_session
│
├── Workflow System (3 tables)
│   ├── workflow
│   ├── workflow_node
│   └── workflow_edge
│
└── Bookmarks & Archives (3 tables)
    ├── bookmark
    ├── archive
    └── archive_item

Total: 28 tables, 30+ indexes, 8 triggers
```

## 🔑 Default Credentials

**⚠️ IMPORTANT: Change immediately after setup!**

```
Email: admin@example.com
Password: admin123
Role: super_admin
```

### Change Password
```sql
-- Connect to database
psql -U postgres -d ai_builder

-- Update password
UPDATE "user" 
SET password = '$2a$10$YOUR_NEW_BCRYPT_HASH',
    email = 'your-email@example.com'
WHERE email = 'admin@example.com';
```

## 🔧 Configuration

### Add to .env
```bash
# Database Connection
DATABASE_URL="postgresql://user:password@localhost:5432/ai_builder"

# Optional: Connection Pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Optional: SSL
DATABASE_SSL=true
```

### For Remote Database
```bash
DATABASE_URL="postgresql://user:password@your-vps-ip:5432/ai_builder"
```

## ✅ Verification

After setup, verify everything works:

```bash
# Check tables
psql -U postgres -d ai_builder -c "\dt"

# Count tables (should be 28)
psql -U postgres -d ai_builder -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Test connection from app
npm run db:studio
```

## 🔒 Security Checklist

After setup, secure your database:

- [ ] Change default admin password
- [ ] Use strong database password
- [ ] Configure firewall (allow only app server)
- [ ] Enable SSL connections
- [ ] Set up regular backups
- [ ] Configure pg_hba.conf for access control
- [ ] Monitor database logs
- [ ] Set up connection pooling

## 📈 Performance Optimization

### PostgreSQL Configuration
Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Connections
max_connections = 100

# Logging
log_min_duration_statement = 1000
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## 🔄 Backup Strategy

### Automated Daily Backups
```bash
# Create backup script
sudo nano /usr/local/bin/backup-db.sh

# Add:
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U postgres ai_builder | gzip > $BACKUP_DIR/ai_builder_$DATE.sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Make executable
sudo chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-db.sh" | sudo crontab -
```

### Manual Backup
```bash
# Backup
pg_dump -U postgres ai_builder > backup.sql

# Restore
psql -U postgres -d ai_builder < backup.sql
```

## 🐛 Troubleshooting

### Common Issues

**"psql: command not found"**
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib
```

**"Connection refused"**
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**"Permission denied"**
```bash
# Grant privileges
sudo -u postgres psql -d ai_builder -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;"
```

**"Database already exists"**
```bash
# Drop and recreate (⚠️ deletes all data!)
sudo -u postgres psql -c "DROP DATABASE ai_builder;"
sudo -u postgres psql -c "CREATE DATABASE ai_builder;"
psql -U postgres -d ai_builder -f schema.sql
```

## 📚 Documentation Files

1. **schema.sql** - Execute this to create database
2. **setup-database.sh** - Automated setup script
3. **DATABASE_SETUP_GUIDE.md** - Complete setup guide
4. **DATABASE_QUICK_REFERENCE.md** - Quick reference
5. **DATABASE_SETUP_COMPLETE.md** - This file

## 🎯 Next Steps

After database setup:

1. ✅ Database created and schema executed
2. Configure your `.env` file with DATABASE_URL
3. Change default admin password
4. Test connection from your application
5. Set up backups
6. Configure security settings
7. Start your application!

## 📞 Support

If you encounter issues:

1. Check [DATABASE_SETUP_GUIDE.md](./DATABASE_SETUP_GUIDE.md) troubleshooting section
2. Review [DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md) for common commands
3. Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`
4. Verify PostgreSQL is running: `sudo systemctl status postgresql`

## 🎉 Success!

Your database is now ready for the AI Builder application!

**What you have:**
- ✅ Complete database schema
- ✅ All 28 tables created
- ✅ All indexes and triggers
- ✅ Default admin account
- ✅ Automated setup script
- ✅ Complete documentation

**Ready to deploy! 🚀**

---

## Quick Command Reference

```bash
# Setup
./setup-database.sh

# Connect
psql -U postgres -d ai_builder

# Backup
pg_dump -U postgres ai_builder > backup.sql

# Restore
psql -U postgres -d ai_builder < backup.sql

# Check status
sudo systemctl status postgresql

# View logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

---

**Database setup package complete! Deploy with confidence! 🎉**
