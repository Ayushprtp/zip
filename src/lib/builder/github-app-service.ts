/**
 * GitHub App Service
 * Handles GitHub App authentication and operations
 */

import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
}

export interface InstallationInfo {
  id: number;
  account: {
    login: string;
    type: string;
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
}

export class GitHubAppService {
  private app: App;
  private config: GitHubAppConfig;

  constructor(config: GitHubAppConfig) {
    this.config = config;
    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
      oauth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      },
    });
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    token: string;
    refreshToken?: string;
    expiresAt?: string;
  }> {
    const { authentication } = await this.app.oauth.createToken({
      code,
    });

    return {
      token: authentication.token,
      refreshToken: authentication.refreshToken,
      expiresAt: authentication.expiresAt,
    };
  }

  /**
   * Get installation access token
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const { token } = await this.app.octokit.auth({
      type: "installation",
      installationId,
    });

    return token as string;
  }

  /**
   * Get user's installations
   */
  async getUserInstallations(userToken: string): Promise<InstallationInfo[]> {
    const octokit = new Octokit({ auth: userToken });
    const { data } = await octokit.apps.listInstallationsForAuthenticatedUser();

    return data.installations.map((installation) => ({
      id: installation.id,
      account: {
        login: installation.account?.login || "",
        type: installation.account?.type || "",
      },
    }));
  }

  /**
   * Get installation repositories
   */
  async getInstallationRepositories(installationId: number) {
    const token = await this.getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.apps.listReposAccessibleToInstallation();

    return data.repositories;
  }

  /**
   * Create repository using installation token
   */
  async createRepository(
    installationId: number,
    options: {
      name: string;
      description?: string;
      private?: boolean;
    },
  ) {
    const token = await this.getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? true,
      auto_init: false,
    });

    return data;
  }

  /**
   * Get authenticated user info
   */
  async getAuthenticatedUser(userToken: string) {
    const octokit = new Octokit({ auth: userToken });
    const { data } = await octokit.users.getAuthenticated();
    return data;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest),
    );
  }

  /**
   * Get app info
   */
  async getAppInfo() {
    const { data } = await this.app.octokit.request("GET /app");
    return data;
  }

  /**
   * Get installation by ID
   */
  async getInstallation(installationId: number) {
    const { data } = await this.app.octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: installationId,
      },
    );
    return data;
  }
}
