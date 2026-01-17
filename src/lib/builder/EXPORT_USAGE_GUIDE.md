# Export Service - Usage Guide

## Overview

The ExportService provides comprehensive project export functionality for the AI Builder IDE. It bundles all virtual files, generates documentation, and creates a downloadable zip file.

## Basic Usage

### In BuilderPage (Already Integrated)

```typescript
import { exportService } from '@/lib/builder/export-service';
import type { TemplateType } from '@/types/builder';

// In your component
const handleExportZip = async () => {
  try {
    const templateType = template as TemplateType;
    
    await exportService.exportZip(files, templateType, {
      projectName: 'my-ai-project',
      includeReadme: true,
      includePackageJson: true,
    });
    
    toast.success("Project exported successfully!");
  } catch (error) {
    console.error("Export failed:", error);
    toast.error("Failed to export project");
  }
};
```

### Standalone Usage

```typescript
import { exportService } from '@/lib/builder/export-service';

// Example files object
const files = {
  '/src/App.tsx': 'import React from "react"...',
  '/src/index.tsx': 'import ReactDOM from "react-dom"...',
  '/index.html': '<!DOCTYPE html>...',
};

// Export with all options
await exportService.exportZip(files, 'vite-react', {
  projectName: 'my-awesome-app',
  includeReadme: true,
  includePackageJson: true,
});
```

## Export Options

### ExportOptions Interface

```typescript
interface ExportOptions {
  projectName?: string;        // Default: 'my-project'
  includeReadme?: boolean;     // Default: true
  includePackageJson?: boolean; // Default: true
}
```

### Option Details

#### projectName
- **Type:** `string`
- **Default:** `'my-project'`
- **Description:** The name of the project used in README and package.json
- **Example:** `'my-awesome-app'`

#### includeReadme
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Whether to auto-generate and include README.md
- **Note:** If a README.md already exists in files, it won't be overwritten

#### includePackageJson
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Whether to ensure package.json exists with all dependencies
- **Note:** If package.json exists, it will be updated with missing dependencies

## Supported Templates

### Vite + React
```typescript
await exportService.exportZip(files, 'vite-react', options);
```

**Generated README includes:**
- Installation: `npm install`
- Run: `npm run dev` (http://localhost:5173)
- Build: `npm run build` (output: `dist/`)
- Dependencies: React, React DOM, Vite, @vitejs/plugin-react

### Next.js
```typescript
await exportService.exportZip(files, 'nextjs', options);
```

**Generated README includes:**
- Installation: `npm install`
- Run: `npm run dev` (http://localhost:3000)
- Build: `npm run build` + `npm start`
- Dependencies: Next.js, React, React DOM, TypeScript

### Node.js
```typescript
await exportService.exportZip(files, 'node', options);
```

**Generated README includes:**
- Installation: `npm install`
- Run: `npm start`
- Build: N/A (Node.js script)
- Dependencies: Node.js specific packages

### Static HTML
```typescript
await exportService.exportZip(files, 'static', options);
```

**Generated README includes:**
- Installation: N/A (No dependencies)
- Run: Open index.html in browser
- Build: N/A (Static files)
- Dependencies: None

## Generated README Structure

The auto-generated README includes:

1. **Project Title and Description**
   - Project name
   - "Created with AI Builder IDE" attribution

2. **Template Information**
   - Which template was used

3. **Getting Started**
   - Prerequisites (Node.js version)
   - Installation instructions
   - Running instructions
   - Build instructions

4. **Project Structure**
   - Visual directory tree
   - File descriptions

5. **Technologies Used**
   - List of dependencies with versions

6. **Learn More**
   - Links to official documentation
   - Framework-specific guides

7. **License**
   - MIT License (default)

## Package.json Management

### Automatic Dependency Inclusion

The ExportService ensures all template dependencies are included:

```typescript
// For vite-react template
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.11",
    "@vitejs/plugin-react": "^4.3.4",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1"
  }
}
```

### Merging with Existing package.json

If a package.json already exists in the files:
1. Existing dependencies are preserved
2. Missing template dependencies are added
3. Scripts are added if missing
4. Project name is updated if not set

## Directory Structure Preservation

The ExportService maintains the correct directory structure:

```
Input files:
{
  '/src/App.tsx': '...',
  '/src/components/Button.tsx': '...',
  '/public/logo.svg': '...',
}

Output zip structure:
my-project.zip
├── src/
│   ├── App.tsx
│   └── components/
│       └── Button.tsx
├── public/
│   └── logo.svg
├── README.md (auto-generated)
└── package.json (auto-generated or updated)
```

## Error Handling

### Common Errors and Solutions

#### Export Failed
```typescript
try {
  await exportService.exportZip(files, template, options);
} catch (error) {
  console.error("Export failed:", error);
  // Handle error (show toast, log, etc.)
}
```

**Possible causes:**
- Invalid template type
- Empty files object
- Browser doesn't support Blob/download
- JSZip error

#### Invalid Template
```typescript
// ❌ Wrong
await exportService.exportZip(files, 'invalid-template', options);

// ✅ Correct
await exportService.exportZip(files, 'vite-react', options);
```

## Advanced Usage

### Custom Project Name from User Input

```typescript
const [projectName, setProjectName] = useState('my-project');

const handleExport = async () => {
  await exportService.exportZip(files, template, {
    projectName: projectName || 'my-project',
    includeReadme: true,
    includePackageJson: true,
  });
};
```

### Conditional README Generation

```typescript
// Only generate README if it doesn't exist
const hasReadme = files['/README.md'] || files['README.md'];

await exportService.exportZip(files, template, {
  projectName: 'my-project',
  includeReadme: !hasReadme, // Don't overwrite existing README
  includePackageJson: true,
});
```

### Export Without Documentation

```typescript
// Minimal export (just files)
await exportService.exportZip(files, template, {
  projectName: 'my-project',
  includeReadme: false,
  includePackageJson: false,
});
```

## Testing

### Manual Testing

```typescript
import { testExport } from '@/lib/builder/export-service-manual-test';

// Run in browser console
testExport();
```

### Integration Testing

```typescript
import { exportService } from '@/lib/builder/export-service';

describe('ExportService', () => {
  it('should export project with README', async () => {
    const files = {
      '/src/App.tsx': 'export default function App() {}',
    };
    
    await exportService.exportZip(files, 'vite-react', {
      projectName: 'test-project',
      includeReadme: true,
      includePackageJson: true,
    });
    
    // Verify download was triggered
    // (In real tests, you'd mock the download)
  });
});
```

## Best Practices

### 1. Always Provide Project Name
```typescript
// ✅ Good
await exportService.exportZip(files, template, {
  projectName: userProvidedName || 'my-project',
});

// ❌ Avoid
await exportService.exportZip(files, template, {});
```

### 2. Handle Errors Gracefully
```typescript
try {
  await exportService.exportZip(files, template, options);
  toast.success("Export successful!");
} catch (error) {
  console.error("Export error:", error);
  toast.error("Export failed. Please try again.");
}
```

### 3. Provide User Feedback
```typescript
const handleExport = async () => {
  toast.info("Preparing export...");
  
  try {
    await exportService.exportZip(files, template, options);
    toast.success("Project exported successfully!");
  } catch (error) {
    toast.error("Failed to export project");
  }
};
```

### 4. Validate Files Before Export
```typescript
const handleExport = async () => {
  if (Object.keys(files).length === 0) {
    toast.error("No files to export");
    return;
  }
  
  await exportService.exportZip(files, template, options);
};
```

## Troubleshooting

### Export button doesn't work
- Check if files object is populated
- Verify template type is valid
- Check browser console for errors

### README not generated
- Verify `includeReadme: true` in options
- Check if README already exists in files
- Verify template type is supported

### package.json missing dependencies
- Verify `includePackageJson: true` in options
- Check template configuration in template-configs.ts
- Verify template type matches expected values

### Zip file structure incorrect
- Check file paths in files object
- Verify paths start with `/`
- Check for duplicate files

## API Reference

### exportService.exportZip()

```typescript
async exportZip(
  files: Record<string, string>,
  template: TemplateType,
  options?: ExportOptions
): Promise<void>
```

**Parameters:**
- `files`: Object mapping file paths to content
- `template`: Template type ('vite-react' | 'nextjs' | 'node' | 'static')
- `options`: Optional export configuration

**Returns:**
- `Promise<void>`: Resolves when download is triggered

**Throws:**
- Error if export fails

## Examples

### Example 1: Basic Export
```typescript
await exportService.exportZip(
  { '/src/App.tsx': 'export default function App() {}' },
  'vite-react'
);
```

### Example 2: Custom Project Name
```typescript
await exportService.exportZip(
  files,
  'nextjs',
  { projectName: 'my-nextjs-app' }
);
```

### Example 3: Minimal Export
```typescript
await exportService.exportZip(
  files,
  'static',
  {
    projectName: 'my-site',
    includeReadme: false,
    includePackageJson: false,
  }
);
```

### Example 4: With User Feedback
```typescript
const handleExport = async () => {
  const loadingToast = toast.loading("Exporting project...");
  
  try {
    await exportService.exportZip(files, template, {
      projectName: 'my-project',
      includeReadme: true,
      includePackageJson: true,
    });
    
    toast.success("Export complete!", { id: loadingToast });
  } catch (error) {
    toast.error("Export failed", { id: loadingToast });
  }
};
```

## Conclusion

The ExportService provides a robust, production-ready solution for exporting AI-generated projects. It handles all the complexity of creating proper project structure, documentation, and dependencies, making it easy for users to download and run their projects locally.

For more information, see:
- `src/lib/builder/export-service.ts` - Implementation
- `src/lib/builder/TASK_15_EXPORT_SUMMARY.md` - Feature summary
- `src/lib/builder/TASK_15_VERIFICATION.md` - Verification report
