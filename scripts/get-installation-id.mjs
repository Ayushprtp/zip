#!/usr/bin/env node
/**
 * Detect the GitHub App installation ID for Flare-SH.
 * Run: node scripts/get-installation-id.mjs
 */

import "dotenv/config";

const appId = process.env.GITHUB_APP_ID;
const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!appId || !privateKey) {
  console.error("Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY in .env");
  process.exit(1);
}

// Use Octokit REST directly with JWT authentication
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: { appId, privateKey },
});

try {
  const { data: installations } = await octokit.request("GET /app/installations");

  if (installations.length === 0) {
    console.log("No installations found for this GitHub App.");
    process.exit(1);
  }

  console.log("\n=== GitHub App Installations ===\n");
  for (const inst of installations) {
    console.log(`  ID: ${inst.id}`);
    console.log(`  Account: ${inst.account?.login}`);
    console.log(`  Type: ${inst.account?.type}`);
    console.log("");
  }

  const target = process.env.GITHUB_APP_OWNER || "Flare-SH";
  const flareInst = installations.find((i) => i.account?.login === target);

  if (flareInst) {
    console.log(`✅ Found "${target}" installation!`);
    console.log(`\nAdd this to .env:\n  FLARE_ORG_INSTALLATION_ID=${flareInst.id}\n`);
  } else {
    console.log(`"${target}" not found. Use an ID from the list above.`);
    console.log(`  FLARE_ORG_INSTALLATION_ID=<id>\n`);
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
