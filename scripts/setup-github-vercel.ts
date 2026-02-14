/**
 * GitHub & Vercel Integration Setup Script
 * Run this to set up the integration
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

console.log("🚀 Setting up GitHub & Vercel Integration...\n");

// Check if dependencies are installed
console.log("📦 Checking dependencies...");
try {
  require.resolve("@isomorphic-git/lightning-fs");
  require.resolve("isomorphic-git");
  require.resolve("@octokit/rest");
  console.log("✅ Dependencies already installed\n");
} catch {
  console.log("📥 Installing dependencies...");
  execSync(
    "npm install @isomorphic-git/lightning-fs isomorphic-git @octokit/rest",
    { stdio: "inherit" },
  );
  console.log("✅ Dependencies installed\n");
}

// Check if migration exists
console.log("🗄️  Checking database migration...");
const migrationPath = join(
  process.cwd(),
  "drizzle/migrations/0002_github_vercel_integration.sql",
);
if (existsSync(migrationPath)) {
  console.log("✅ Migration file exists\n");
} else {
  console.log("❌ Migration file not found!");
  console.log("   Expected at:", migrationPath);
  console.log("   Please ensure the migration file is created.\n");
}

// Check .env file
console.log("🔧 Checking environment variables...");
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");

  const requiredVars = ["NEXT_PUBLIC_APP_URL"];

  const optionalVars = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_REDIRECT_URI",
  ];

  const missingRequired = requiredVars.filter((v) => !envContent.includes(v));
  const missingOptional = optionalVars.filter((v) => !envContent.includes(v));

  if (missingRequired.length > 0) {
    console.log("⚠️  Missing required environment variables:");
    missingRequired.forEach((v) => console.log(`   - ${v}`));
    console.log("\n   Adding defaults to .env...");

    let additions = "\n# GitHub & Vercel Integration\n";
    if (!envContent.includes("NEXT_PUBLIC_APP_URL")) {
      additions += "NEXT_PUBLIC_APP_URL=http://localhost:3000\n";
    }

    writeFileSync(envPath, envContent + additions);
    console.log("✅ Added default values\n");
  } else {
    console.log("✅ Required environment variables present\n");
  }

  if (missingOptional.length > 0) {
    console.log("ℹ️  Optional environment variables (for OAuth):");
    missingOptional.forEach((v) => console.log(`   - ${v}`));
    console.log("   These are optional. Users can provide tokens directly.\n");
  }
} else {
  console.log("⚠️  .env file not found");
  console.log("   Creating .env with defaults...");

  const defaultEnv = `# GitHub & Vercel Integration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: GitHub OAuth (users can provide tokens directly)
# GITHUB_CLIENT_ID=your_github_client_id
# GITHUB_CLIENT_SECRET=your_github_client_secret
# GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
`;

  writeFileSync(envPath, defaultEnv);
  console.log("✅ Created .env file\n");
}

// Instructions
console.log("📋 Setup Complete! Next steps:\n");
console.log("1. Run database migration:");
console.log("   npm run db:migrate\n");
console.log("2. Get your tokens:");
console.log("   GitHub: https://github.com/settings/tokens");
console.log("   Vercel: https://vercel.com/account/tokens\n");
console.log("3. Add the integration to your builder:");
console.log(
  '   import { GitHubVercelButton } from "@/components/builder/github-vercel-button";',
);
console.log("   <GitHubVercelButton />\n");
console.log("4. Start your app:");
console.log("   npm run dev\n");
console.log("📚 Documentation:");
console.log("   Quick Start: src/lib/builder/GITHUB_VERCEL_QUICK_START.md");
console.log(
  "   Full Guide: src/lib/builder/GITHUB_VERCEL_INTEGRATION_GUIDE.md",
);
console.log("   README: src/lib/builder/GITHUB_VERCEL_README.md\n");
console.log("🎉 Ready to build with GitHub & Vercel integration!");
