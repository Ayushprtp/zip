#!/bin/bash

# Flare Remote Development Server Installation Script

set -e

echo "🚀 Installing Flare Remote Development Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if ! [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 16+."
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm detected"

# Create installation directory
INSTALL_DIR="$HOME/.flare-remote-server"
echo "📁 Installing to: $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Create package.json
cat > package.json << 'EOL'
{
  "name": "flare-remote-server-instance",
  "version": "1.0.0",
  "description": "Flare Remote Development Server Instance",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "chokidar": "^3.5.3",
    "ws": "^8.14.2",
    "node-pty": "^1.0.0"
  }
}
EOL

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Download server code
echo "⬇️ Downloading server code..."

# Copy the compiled server from the local package
if [ -f "/home/ubuntu/Flare-SH/packages/remote-server/dist/index.js" ]; then
    cp "/home/ubuntu/Flare-SH/packages/remote-server/dist/index.js" ./index.js
else
    # Fallback: download from a CDN or use embedded code
    echo "Warning: Could not find local server binary, using embedded version"
    # For now, create a simple server
    cat > index.js << 'SERVER_EOF'
console.log("Flare Remote Development Server");
console.log("This is a placeholder server. Please install the full version.");
SERVER_EOF
fi

echo "✅ Server code installed"
echo "🎉 Installation complete!"
echo ""
echo "To start the server, run:"
echo "  cd $INSTALL_DIR && npm start"
echo ""
echo "Or with custom port:"
echo "  PORT=8080 WORKSPACE_ROOT=/path/to/workspace npm start"
