/**
 * ExportService - Handles project export to zip files
 *
 * This service bundles all virtual files with correct directory structure,
 * auto-generates README.md with setup instructions, includes package.json
 * with all dependencies, and triggers browser download.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import JSZip from "jszip";
import type { TemplateType } from "@/types/builder";
import { TEMPLATE_CONFIGS } from "./template-configs";

export interface ExportOptions {
  projectName?: string;
  includeReadme?: boolean;
  includePackageJson?: boolean;
}

export class ExportService {
  /**
   * Export project files as a zip file
   *
   * @param files - Record of file paths to content
   * @param template - The template type (vite-react, nextjs, node, static)
   * @param options - Export options
   * @returns Promise that resolves when download is triggered
   */
  async exportZip(
    files: Record<string, string>,
    template: TemplateType,
    options: ExportOptions = {},
  ): Promise<void> {
    const {
      projectName = "my-project",
      includeReadme = true,
      includePackageJson = true,
    } = options;

    const zip = new JSZip();

    // Add all virtual files with correct directory structure
    for (const [path, content] of Object.entries(files)) {
      // Remove leading slash for zip file paths
      const cleanPath = path.replace(/^\//, "");
      zip.file(cleanPath, content);
    }

    // Auto-generate README.md if not present and includeReadme is true
    if (includeReadme && !files["/README.md"] && !files["README.md"]) {
      const readme = this.generateReadme(template, projectName);
      zip.file("README.md", readme);
    }

    // Ensure package.json exists with all dependencies
    if (includePackageJson) {
      const packageJsonPath = files["/package.json"]
        ? "/package.json"
        : "package.json";
      const existingPackageJson =
        files[packageJsonPath] || files["/package.json"];

      if (existingPackageJson) {
        // Update existing package.json to ensure all dependencies are included
        const updatedPackageJson = this.ensurePackageJsonComplete(
          existingPackageJson,
          template,
          projectName,
        );
        zip.file("package.json", updatedPackageJson);
      } else {
        // Create new package.json
        const packageJson = this.generatePackageJson(template, projectName);
        zip.file("package.json", packageJson);
      }
    }

    // Generate zip blob
    const blob = await zip.generateAsync({ type: "blob" });

    // Trigger browser download
    this.triggerDownload(blob, `${projectName}.zip`);
  }

  /**
   * Generate README.md with setup instructions
   */
  private generateReadme(template: TemplateType, projectName: string): string {
    let installCommand = "npm install";
    let runCommand = "npm run dev";
    let buildCommand = "npm run build";

    // Customize commands based on template
    switch (template) {
      case "vite-react":
        runCommand = "npm run dev";
        buildCommand = "npm run build";
        break;
      case "nextjs":
        runCommand = "npm run dev";
        buildCommand = "npm run build";
        break;
      case "node":
        runCommand = "npm start";
        buildCommand = "N/A (Node.js script)";
        break;
      case "static":
        runCommand = "Open index.html in browser";
        buildCommand = "N/A (Static files)";
        installCommand = "N/A (No dependencies)";
        break;
    }

    return `# ${projectName}

This project was created with AI Builder IDE.

## Template

This project uses the **${template}** template.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager

### Installation

1. Extract the zip file to your desired location
2. Open a terminal in the project directory
3. Install dependencies:

\`\`\`bash
${installCommand}
\`\`\`

### Running the Project

To start the development server:

\`\`\`bash
${runCommand}
\`\`\`

${template === "vite-react" ? "The application will be available at http://localhost:5173" : ""}
${template === "nextjs" ? "The application will be available at http://localhost:3000" : ""}
${template === "node" ? "The script will execute and output to the console" : ""}
${template === "static" ? "Simply open the index.html file in your web browser" : ""}

### Building for Production

${
  buildCommand !== "N/A (Node.js script)" &&
  buildCommand !== "N/A (Static files)"
    ? `
To create a production build:

\`\`\`bash
${buildCommand}
\`\`\`

${template === "vite-react" ? "The build output will be in the `dist` directory." : ""}
${template === "nextjs" ? "The build output will be in the `.next` directory. Run `npm start` to serve the production build." : ""}
`
    : buildCommand
}

## Project Structure

${this.generateProjectStructure(template)}

## Technologies Used

${this.generateTechnologiesList(template)}

## Learn More

${this.generateLearnMoreLinks(template)}

## License

This project is open source and available under the MIT License.

---

Generated by AI Builder IDE
`;
  }

  /**
   * Generate project structure documentation
   */
  private generateProjectStructure(template: TemplateType): string {
    switch (template) {
      case "vite-react":
        return `\`\`\`
├── index.html          # Entry HTML file
├── src/
│   ├── main.tsx        # Application entry point
│   ├── App.tsx         # Main App component
│   ├── App.css         # App styles
│   └── index.css       # Global styles
├── vite.config.ts      # Vite configuration
└── package.json        # Project dependencies
\`\`\``;

      case "nextjs":
        return `\`\`\`
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── next.config.js      # Next.js configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
\`\`\``;

      case "node":
        return `\`\`\`
├── index.js            # Main entry point
└── package.json        # Project dependencies
\`\`\``;

      case "static":
        return `\`\`\`
├── index.html          # Main HTML file
├── style.css           # Styles
└── script.js           # JavaScript
\`\`\``;

      default:
        return "See files in the project directory.";
    }
  }

  /**
   * Generate technologies list
   */
  private generateTechnologiesList(template: TemplateType): string {
    const config = TEMPLATE_CONFIGS[template];
    const deps = { ...config.dependencies, ...config.devDependencies };

    const technologies: string[] = [];

    if (deps.react) technologies.push(`- React ${deps.react}`);
    if (deps["react-dom"])
      technologies.push(`- React DOM ${deps["react-dom"]}`);
    if (deps.next) technologies.push(`- Next.js ${deps.next}`);
    if (deps.vite) technologies.push(`- Vite ${deps.vite}`);
    if (deps.typescript) technologies.push(`- TypeScript ${deps.typescript}`);

    if (technologies.length === 0) {
      return "- Pure HTML, CSS, and JavaScript";
    }

    return technologies.join("\n");
  }

  /**
   * Generate learn more links
   */
  private generateLearnMoreLinks(template: TemplateType): string {
    switch (template) {
      case "vite-react":
        return `- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Vite + React Guide](https://vitejs.dev/guide/)`;

      case "nextjs":
        return `- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Learn Next.js](https://nextjs.org/learn)`;

      case "node":
        return `- [Node.js Documentation](https://nodejs.org/docs/)
- [npm Documentation](https://docs.npmjs.com/)`;

      case "static":
        return `- [MDN Web Docs](https://developer.mozilla.org/)
- [HTML Reference](https://developer.mozilla.org/en-US/docs/Web/HTML)
- [CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript)`;

      default:
        return "- See official documentation for the technologies used";
    }
  }

  /**
   * Ensure package.json is complete with all dependencies
   */
  private ensurePackageJsonComplete(
    existingPackageJson: string,
    template: TemplateType,
    projectName: string,
  ): string {
    try {
      const pkg = JSON.parse(existingPackageJson);
      const config = TEMPLATE_CONFIGS[template];

      // Update name if not set
      if (!pkg.name) {
        pkg.name = projectName;
      }

      // Ensure dependencies are present
      pkg.dependencies = {
        ...config.dependencies,
        ...(pkg.dependencies || {}),
      };

      // Ensure devDependencies are present
      if (
        config.devDependencies &&
        Object.keys(config.devDependencies).length > 0
      ) {
        pkg.devDependencies = {
          ...config.devDependencies,
          ...(pkg.devDependencies || {}),
        };
      }

      // Ensure scripts are present
      if (!pkg.scripts) {
        pkg.scripts = this.getDefaultScripts(template);
      }

      return JSON.stringify(pkg, null, 2);
    } catch (_error) {
      // If parsing fails, generate new package.json
      return this.generatePackageJson(template, projectName);
    }
  }

  /**
   * Generate a new package.json
   */
  private generatePackageJson(
    template: TemplateType,
    projectName: string,
  ): string {
    const config = TEMPLATE_CONFIGS[template];

    const pkg: any = {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: this.getDefaultScripts(template),
      dependencies: config.dependencies,
    };

    if (
      config.devDependencies &&
      Object.keys(config.devDependencies).length > 0
    ) {
      pkg.devDependencies = config.devDependencies;
    }

    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Get default scripts for a template
   */
  private getDefaultScripts(template: TemplateType): Record<string, string> {
    switch (template) {
      case "vite-react":
        return {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        };

      case "nextjs":
        return {
          dev: "next dev",
          build: "next build",
          start: "next start",
        };

      case "node":
        return {
          start: "node index.js",
        };

      case "static":
        return {};

      default:
        return {};
    }
  }

  /**
   * Trigger browser download
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const exportService = new ExportService();
