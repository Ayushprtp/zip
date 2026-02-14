import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test the remote server installation and startup
async function testRemoteServer() {
  console.log('🧪 Testing Flare Remote Development Server...');

  try {
    // Test 1: Check if the package.json exists
    const packagePath = path.join(__dirname, 'packages', 'remote-server', 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('package.json not found in remote-server package');
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('✅ Package.json found:', packageJson.name, packageJson.version);

    // Test 2: Check if the install script exists
    const installScriptPath = path.join(__dirname, 'packages', 'remote-server', 'install.sh');
    if (!fs.existsSync(installScriptPath)) {
      throw new Error('install.sh not found in remote-server package');
    }
    console.log('✅ Install script found');

    // Test 3: Check if the server code exists
    const serverPath = path.join(__dirname, 'packages', 'remote-server', 'src', 'index.ts');
    if (!fs.existsSync(serverPath)) {
      throw new Error('Server source code not found');
    }
    console.log('✅ Server source code found');

    console.log('🎉 All basic checks passed!');
    console.log('');
    console.log('To test the server manually:');
    console.log('1. Run: bash packages/remote-server/install.sh');
    console.log('2. Check if server starts on port 37507');
    console.log('3. Visit: http://localhost:37507/health');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRemoteServer();
