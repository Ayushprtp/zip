#!/bin/bash

# ============================================================================
# AI Builder Database Setup Script
# ============================================================================
# This script automates the database setup process
# Run with: bash setup-database.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="ai_builder"
DB_USER="ai_builder_user"
SCHEMA_FILE="schema.sql"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}AI Builder Database Setup${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed!${NC}"
    echo ""
    echo "Install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  CentOS/RHEL:   sudo yum install postgresql-server postgresql-contrib"
    echo "  macOS:         brew install postgresql@14"
    exit 1
fi

echo -e "${GREEN}✓${NC} PostgreSQL is installed"

# Check if PostgreSQL is running
if ! sudo systemctl is-active --quiet postgresql 2>/dev/null && ! pgrep -x postgres > /dev/null; then
    echo -e "${YELLOW}⚠${NC} PostgreSQL is not running. Starting..."
    sudo systemctl start postgresql 2>/dev/null || {
        echo -e "${RED}❌ Failed to start PostgreSQL${NC}"
        echo "Start it manually: sudo systemctl start postgresql"
        exit 1
    }
fi

echo -e "${GREEN}✓${NC} PostgreSQL is running"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Schema file found"
echo ""

# Prompt for database details
echo -e "${YELLOW}Database Configuration:${NC}"
read -p "Database name [$DB_NAME]: " input_db_name
DB_NAME=${input_db_name:-$DB_NAME}

read -p "Database user [$DB_USER]: " input_db_user
DB_USER=${input_db_user:-$DB_USER}

read -sp "Database password: " DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ Password cannot be empty${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Creating database...${NC}"

# Create database and user
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME

-- Grant schema privileges
GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Database and user created"
else
    echo -e "${RED}❌ Failed to create database${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Executing schema...${NC}"

# Execute schema
sudo -u postgres psql -d $DB_NAME -f $SCHEMA_FILE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Schema executed successfully"
else
    echo -e "${RED}❌ Failed to execute schema${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Verifying installation...${NC}"

# Verify tables
TABLE_COUNT=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
TABLE_COUNT=$(echo $TABLE_COUNT | tr -d ' ')

if [ "$TABLE_COUNT" -eq 28 ]; then
    echo -e "${GREEN}✓${NC} All 28 tables created"
else
    echo -e "${YELLOW}⚠${NC} Expected 28 tables, found $TABLE_COUNT"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Database Details:${NC}"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Tables: $TABLE_COUNT"
echo ""
echo -e "${YELLOW}Connection String:${NC}"
echo "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\""
echo ""
echo -e "${YELLOW}Default Admin Account:${NC}"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo -e "  ${RED}⚠ CHANGE THIS PASSWORD IMMEDIATELY!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Add DATABASE_URL to your .env file"
echo "  2. Change the default admin password"
echo "  3. Start your application"
echo ""
echo -e "${BLUE}============================================================================${NC}"

# Offer to add to .env
if [ -f ".env" ]; then
    echo ""
    read -p "Add DATABASE_URL to .env file? (y/n): " add_to_env
    if [ "$add_to_env" = "y" ] || [ "$add_to_env" = "Y" ]; then
        if grep -q "DATABASE_URL=" .env; then
            echo -e "${YELLOW}⚠${NC} DATABASE_URL already exists in .env"
            read -p "Replace it? (y/n): " replace
            if [ "$replace" = "y" ] || [ "$replace" = "Y" ]; then
                sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\"|" .env
                echo -e "${GREEN}✓${NC} DATABASE_URL updated in .env"
            fi
        else
            echo "" >> .env
            echo "# Database Configuration" >> .env
            echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\"" >> .env
            echo -e "${GREEN}✓${NC} DATABASE_URL added to .env"
        fi
    fi
fi

echo ""
echo -e "${GREEN}Setup complete! Happy building! 🚀${NC}"
