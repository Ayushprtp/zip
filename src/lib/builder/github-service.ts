/**
 * GitHub Service
 * Handles GitHub API operations and OAuth
 */

import { Octokit } from "@octokit/rest";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(private token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async createRepo(options: CreateRepoOptions): Promise<GitHubRepo> {
    const response = await this.octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description || "",
      private: options.private ?? true,
      auto_init: options.auto_init ?? false,
    });

    return response.data as GitHubRepo;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const response = await this.octokit.repos.get({
      owner,
      repo,
    });

    return response.data as GitHubRepo;
  }

  async listRepos(): Promise<GitHubRepo[]> {
    const response = await this.octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
    });

    return response.data as GitHubRepo[];
  }

  async deleteRepo(owner: string, repo: string): Promise<void> {
    await this.octokit.repos.delete({
      owner,
      repo,
    });
  }

  async getAuthenticatedUser() {
    const response = await this.octokit.users.getAuthenticated();
    return response.data;
  }

  async checkRepoExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getRepo(owner, repo);
      return true;
    } catch {
      return false;
    }
  }

  async updateRepo(
    owner: string,
    repo: string,
    options: { description?: string; private?: boolean },
  ): Promise<GitHubRepo> {
    const response = await this.octokit.repos.update({
      owner,
      repo,
      ...options,
    });

    return response.data as GitHubRepo;
  }

  async getCommits(owner: string, repo: string, per_page = 30) {
    const response = await this.octokit.repos.listCommits({
      owner,
      repo,
      per_page,
    });

    return response.data;
  }

  async getBranches(owner: string, repo: string) {
    const response = await this.octokit.repos.listBranches({
      owner,
      repo,
    });

    return response.data;
  }

  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    events: string[] = ["push"],
  ) {
    const response = await this.octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
      },
      events,
    });

    return response.data;
  }
}
