/**
 * Vercel Service
 * Handles Vercel API operations for deployments
 */

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  framework: string | null;
  devCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  link?: {
    type: string;
    repo: string;
    repoId: number;
    org: string;
    gitCredentialId: string;
    productionBranch: string;
  };
}

export interface VercelDeployment {
  id: string;
  url: string;
  name: string;
  state: "BUILDING" | "READY" | "ERROR" | "CANCELED";
  type: "LAMBDAS";
  created: number;
  creator: {
    uid: string;
    username: string;
  };
  meta: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
  target: "production" | "staging" | null;
  aliasError: any;
  readyState:
    | "QUEUED"
    | "BUILDING"
    | "READY"
    | "ERROR"
    | "CANCELED"
    | "INITIALIZING";
}

export interface CreateProjectOptions {
  name: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  devCommand?: string;
  gitRepository?: {
    type: "github";
    repo: string;
  };
  environmentVariables?: Array<{
    key: string;
    value: string;
    target: ("production" | "preview" | "development")[];
  }>;
}

export class VercelService {
  private baseUrl = "https://api.vercel.com";

  constructor(private token: string) {}

  private async fetch(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Vercel API error: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async createProject(options: CreateProjectOptions): Promise<VercelProject> {
    const response = await this.fetch("/v9/projects", {
      method: "POST",
      body: JSON.stringify(options),
    });

    return response;
  }

  async getProject(projectId: string): Promise<VercelProject> {
    const response = await this.fetch(`/v9/projects/${projectId}`);
    return response;
  }

  async listProjects(): Promise<VercelProject[]> {
    const response = await this.fetch("/v9/projects");
    return response.projects || [];
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.fetch(`/v9/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  async linkGitHubRepo(
    projectId: string,
    repoFullName: string,
    productionBranch = "main",
  ): Promise<VercelProject> {
    const response = await this.fetch(`/v9/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({
        link: {
          type: "github",
          repo: repoFullName,
          productionBranch,
        },
      }),
    });

    return response;
  }

  async getDeployments(projectId: string): Promise<VercelDeployment[]> {
    const response = await this.fetch(
      `/v6/deployments?projectId=${projectId}&limit=20`,
    );
    return response.deployments || [];
  }

  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    const response = await this.fetch(`/v13/deployments/${deploymentId}`);
    return response;
  }

  async createDeployment(
    projectId: string,
    gitSource?: {
      type: "github";
      ref: string;
      repoId: number;
    },
  ): Promise<VercelDeployment> {
    const body: any = {
      name: projectId,
      target: "production",
    };

    if (gitSource) {
      body.gitSource = gitSource;
    }

    const response = await this.fetch("/v13/deployments", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return response;
  }

  async promoteDeployment(
    projectId: string,
    deploymentId: string,
  ): Promise<void> {
    await this.fetch(
      `/v9/projects/${projectId}/promote/${deploymentId}`,
      {
        method: "PATCH",
      },
    );
  }

  async cancelDeployment(deploymentId: string): Promise<void> {
    await this.fetch(`/v12/deployments/${deploymentId}/cancel`, {
      method: "PATCH",
    });
  }

  async getDeploymentLogs(deploymentId: string): Promise<any[]> {
    const response = await this.fetch(
      `/v2/deployments/${deploymentId}/events`,
    );
    return response;
  }

  async setEnvironmentVariables(
    projectId: string,
    variables: Array<{
      key: string;
      value: string;
      target: ("production" | "preview" | "development")[];
    }>,
  ): Promise<void> {
    for (const variable of variables) {
      await this.fetch(`/v9/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify(variable),
      });
    }
  }

  async getEnvironmentVariables(projectId: string): Promise<any[]> {
    const response = await this.fetch(`/v9/projects/${projectId}/env`);
    return response.envs || [];
  }

  async deleteEnvironmentVariable(
    projectId: string,
    envId: string,
  ): Promise<void> {
    await this.fetch(`/v9/projects/${projectId}/env/${envId}`, {
      method: "DELETE",
    });
  }

  async getUser() {
    const response = await this.fetch("/v2/user");
    return response.user;
  }

  async getTeams() {
    const response = await this.fetch("/v2/teams");
    return response.teams || [];
  }
}
