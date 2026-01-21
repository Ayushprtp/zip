#!/bin/bash

echo "🔍 Verifying GitHub & Vercel Integration Implementation..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
PASSED=0
FAILED=0

check_file() {
    TOTAL=$((TOTAL + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        FAILED=$((FAILED + 1))
    fi
}

echo "📦 Checking Core Services..."
check_file "src/lib/builder/virtual-fs-service.ts"
check_file "src/lib/builder/git-service.ts"
check_file "src/lib/builder/github-service.ts"
check_file "src/lib/builder/vercel-service.ts"
check_file "src/lib/builder/git-sync-service.ts"
check_file "src/lib/builder/use-github-integration.ts"
check_file "src/lib/builder/use-vercel-integration.ts"
echo ""

echo "🔌 Checking API Routes..."
check_file "src/app/api/git-proxy/route.ts"
check_file "src/app/api/github/auth/route.ts"
check_file "src/app/api/github/repos/route.ts"
check_file "src/app/api/github/user/route.ts"
check_file "src/app/api/vercel/auth/route.ts"
check_file "src/app/api/vercel/projects/route.ts"
check_file "src/app/api/vercel/deployments/route.ts"
echo ""

echo "🎨 Checking UI Components..."
check_file "src/components/builder/github-connection-panel.tsx"
check_file "src/components/builder/vercel-connection-panel.tsx"
check_file "src/components/builder/git-history-sidebar.tsx"
check_file "src/components/builder/deployment-dashboard.tsx"
check_file "src/components/builder/github-vercel-integration.tsx"
check_file "src/components/builder/github-vercel-button.tsx"
echo ""

echo "🗄️ Checking Database..."
check_file "src/db/schema/builder.ts"
check_file "drizzle/migrations/0002_github_vercel_integration.sql"
echo ""

echo "📚 Checking Documentation..."
check_file "src/lib/builder/GITHUB_VERCEL_INTEGRATION_GUIDE.md"
check_file "src/lib/builder/GITHUB_VERCEL_QUICK_START.md"
check_file "src/lib/builder/GITHUB_VERCEL_README.md"
check_file "GITHUB_VERCEL_INTEGRATION_COMPLETE.md"
check_file "GITHUB_VERCEL_CHECKLIST.md"
check_file "IMPLEMENTATION_SUMMARY.md"
check_file "GITHUB_VERCEL_ARCHITECTURE.md"
check_file "GITHUB_VERCEL_FILE_INDEX.md"
check_file "README_GITHUB_VERCEL.md"
echo ""

echo "🧪 Checking Tests & Setup..."
check_file "src/lib/builder/github-vercel-integration.test.ts"
check_file "scripts/setup-github-vercel.ts"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Results:"
echo "   Total Files: $TOTAL"
echo -e "   ${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "   ${RED}Failed: $FAILED${NC}"
else
    echo -e "   ${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All files verified successfully!${NC}"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. npm run db:migrate"
    echo "   2. Get your GitHub and Vercel tokens"
    echo "   3. Add <GitHubVercelButton /> to your builder"
    echo "   4. npm run dev"
    echo ""
    echo "📚 Documentation: src/lib/builder/GITHUB_VERCEL_QUICK_START.md"
else
    echo -e "${RED}❌ Some files are missing!${NC}"
    echo "   Please check the implementation."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
