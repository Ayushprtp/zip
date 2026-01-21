/**
 * GitHub App Webhook Handler
 */

import { NextRequest, NextResponse } from "next/server";
import { GitHubAppService } from "@/lib/builder/github-app-service";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");
    const delivery = request.headers.get("x-github-delivery");

    if (!signature || !event) {
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 400 },
      );
    }

    const payload = await request.text();

    // Verify webhook signature
    const githubApp = new GitHubAppService({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    });

    const isValid = githubApp.verifyWebhookSignature(
      payload,
      signature,
      GITHUB_WEBHOOK_SECRET,
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const data = JSON.parse(payload);

    // Handle different webhook events
    switch (event) {
      case "push":
        console.log("Push event received:", {
          repository: data.repository?.full_name,
          ref: data.ref,
          commits: data.commits?.length,
        });
        // Trigger Vercel deployment or other actions
        break;

      case "installation":
        console.log("Installation event:", {
          action: data.action,
          installation_id: data.installation?.id,
        });
        // Handle app installation/uninstallation
        break;

      case "installation_repositories":
        console.log("Installation repositories event:", {
          action: data.action,
          repositories_added: data.repositories_added?.length,
          repositories_removed: data.repositories_removed?.length,
        });
        // Handle repository access changes
        break;

      default:
        console.log("Unhandled event:", event);
    }

    return NextResponse.json({ success: true, event, delivery });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 },
    );
  }
}
