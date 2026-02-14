#!/bin/bash

# Database Verification Script
# Checks if database is properly set up

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

DB_NAME="flaredb"

echo "🔍 Verifying Database Setup..."
echo ""

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} PostgreSQL installed"

# Check if database exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${GREEN}✓${NC} Database exists"
else
    echo -e "${RED}❌ Database does not exist${NC}"
    exit 1
fi

# Count tables
TABLE_COUNT=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ "$TABLE_COUNT" -eq 28 ]; then
    echo -e "${GREEN}✓${NC} All 28 tables present"
else
    echo -e "${YELLOW}⚠${NC} Expected 28 tables, found $TABLE_COUNT"
fi

# Check admin user
ADMIN_EXISTS=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"user\" WHERE email = 'admin@example.com';" | tr -d ' ')

if [ "$ADMIN_EXISTS" -eq 1 ]; then
    echo -e "${GREEN}✓${NC} Admin user exists"
    echo -e "${YELLOW}⚠${NC} Remember to change default password!"
else
    echo -e "${YELLOW}⚠${NC} Admin user not found"
fi

# Check indexes
INDEX_COUNT=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" | tr -d ' ')
echo -e "${GREEN}✓${NC} $INDEX_COUNT indexes created"

# Database size
DB_SIZE=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')
echo -e "${GREEN}✓${NC} Database size: $DB_SIZE"

echo ""
echo -e "${GREEN}✅ Database verification complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Add DATABASE_URL to .env"
echo "2. Change admin password"
echo "3. Start your application"

