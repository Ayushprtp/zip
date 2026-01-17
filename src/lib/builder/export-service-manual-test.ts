/**
 * Manual test for ExportService
 * Run this to verify the export functionality works
 */

import { exportService } from "./export-service";

// Test data
const testFiles = {
  "/src/App.tsx": `import React from 'react';

function App() {
  return <div>Hello World</div>;
}

export default App;`,
  "/src/index.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);`,
  "/index.html": `<!DOCTYPE html>
<html>
  <head><title>Test App</title></head>
  <body><div id="root"></div></body>
</html>`,
};

async function testExport() {
  console.log("Testing ExportService...");

  try {
    // Test with vite-react template
    console.log("Testing vite-react export...");
    await exportService.exportZip(testFiles, "vite-react", {
      projectName: "test-vite-project",
      includeReadme: true,
      includePackageJson: true,
    });
    console.log("✓ Vite-React export successful");

    // Test with nextjs template
    console.log("Testing nextjs export...");
    await exportService.exportZip(testFiles, "nextjs", {
      projectName: "test-nextjs-project",
      includeReadme: true,
      includePackageJson: true,
    });
    console.log("✓ Next.js export successful");

    console.log("\nAll tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run test if this file is executed directly
if (typeof window !== "undefined") {
  testExport();
}

export { testExport };
