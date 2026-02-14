#!/usr/bin/env node

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as pty from 'node-pty';

const PORT = process.env.PORT || 37507;
const HOST = process.env.HOST || '127.0.0.1';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

interface TerminalSession {
  id: string;
  pty: pty.IPty;
  socket: any;
  cwd: string;
}

class FlareRemoteServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private wss: WebSocketServer;
  private watcher: chokidar.FSWatcher;
  private workspaceRoot: string;
  private terminals: Map<string, TerminalSession> = new Map();

  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.wss = new WebSocketServer({ server: this.server });
    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    this.setupMiddleware();
    this.setupWebSocket();
    this.setupFileWatcher();
    this.setupRoutes();
  }

  private setupFileWatcher() {
    this.watcher.on('all', (event: string, filePath: string) => {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      this.io.emit('file-change', {
        event,
        path: relativePath,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up any terminals for this socket
        this.cleanupTerminals(socket.id);
      });

      // File operations
      socket.on('read-file', async (data: { path: string, encoding?: string }) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const encoding: BufferEncoding = (data.encoding as BufferEncoding) || 'utf8';
          const content = fs.readFileSync(filePath, encoding);
          socket.emit('file-content', { path: data.path, content, encoding });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('write-file', async (data: { path: string, content: string, encoding?: string }) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const encoding: BufferEncoding = (data.encoding as BufferEncoding) || 'utf8';
          fs.writeFileSync(filePath, data.content, encoding);
          socket.emit('file-saved', { path: data.path });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('create-file', async (data: { path: string, content?: string }) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Ensure directory exists
          const dir = path.dirname(filePath);
          fs.mkdirSync(dir, { recursive: true });

          fs.writeFileSync(filePath, data.content || '', 'utf8');
          socket.emit('file-created', { path: data.path });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('delete-file', async (data: { path: string, recursive?: boolean }) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const stats = fs.statSync(filePath);
          if (stats.isDirectory() && data.recursive) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else if (stats.isFile()) {
            fs.unlinkSync(filePath);
          } else {
            throw new Error('Cannot delete directory without recursive flag');
          }

          socket.emit('file-deleted', { path: data.path });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('rename-file', async (data: { oldPath: string, newPath: string }) => {
        try {
          const oldFilePath = path.resolve(this.workspaceRoot, data.oldPath);
          const newFilePath = path.resolve(this.workspaceRoot, data.newPath);

          if (!oldFilePath.startsWith(this.workspaceRoot) || !newFilePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Ensure new directory exists
          const newDir = path.dirname(newFilePath);
          fs.mkdirSync(newDir, { recursive: true });

          fs.renameSync(oldFilePath, newFilePath);
          socket.emit('file-renamed', { oldPath: data.oldPath, newPath: data.newPath });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('list-directory', async (data: { path: string, recursive?: boolean }) => {
        try {
          const dirPath = path.resolve(this.workspaceRoot, data.path || '');
          if (!dirPath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const items = this.listDirectoryRecursive(dirPath, data.recursive || false);
          socket.emit('directory-listing', { path: data.path, items });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      // Terminal operations
      socket.on('create-terminal', async (data: { id: string, cols?: number, rows?: number, cwd?: string }) => {
        try {
          const terminalId = data.id;
          const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;

          if (!cwd.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const ptyProcess = pty.spawn(process.env.SHELL || '/bin/bash', [], {
            name: 'xterm-color',
            cols: data.cols || 80,
            rows: data.rows || 24,
            cwd: cwd,
            env: { ...process.env, PWD: cwd }
          });

          const terminalSession: TerminalSession = {
            id: terminalId,
            pty: ptyProcess,
            socket: socket,
            cwd: cwd
          };

          this.terminals.set(terminalId, terminalSession);

          ptyProcess.onData((data) => {
            socket.emit('terminal-data', { id: terminalId, data });
          });

          ptyProcess.onExit(() => {
            socket.emit('terminal-exit', { id: terminalId });
            this.terminals.delete(terminalId);
          });

          socket.emit('terminal-created', { id: terminalId });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('terminal-input', (data: { id: string, input: string }) => {
        const terminal = this.terminals.get(data.id);
        if (terminal) {
          terminal.pty.write(data.input);
        }
      });

      socket.on('resize-terminal', (data: { id: string, cols: number, rows: number }) => {
        const terminal = this.terminals.get(data.id);
        if (terminal) {
          terminal.pty.resize(data.cols, data.rows);
        }
      });

      socket.on('close-terminal', (data: { id: string }) => {
        const terminal = this.terminals.get(data.id);
        if (terminal) {
          terminal.pty.kill();
          this.terminals.delete(data.id);
        }
      });

      // Git operations
      socket.on('git-status', async (data: { cwd?: string }) => {
        try {
          const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
          if (!cwd.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const result = await this.runCommand('git status --porcelain', cwd);
          socket.emit('git-status-result', { status: result.stdout, cwd: data.cwd });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('git-commit', async (data: { message: string, files?: string[], cwd?: string }) => {
        try {
          const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
          if (!cwd.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Add files if specified
          if (data.files && data.files.length > 0) {
            await this.runCommand(`git add ${data.files.join(' ')}`, cwd);
          }

          // Commit
          const result = await this.runCommand(`git commit -m "${data.message.replace(/"/g, '\\"')}"`, cwd);
          socket.emit('git-commit-result', { result: result.stdout, cwd: data.cwd });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      // Search operations
      socket.on('search-files', async (data: { query: string, include?: string, exclude?: string, cwd?: string }) => {
        try {
          const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
          if (!cwd.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const results = await this.searchFiles(cwd, data.query, data.include, data.exclude);
          socket.emit('search-results', { query: data.query, results, cwd: data.cwd });
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      // Task running
      socket.on('run-task', async (data: { command: string, cwd?: string, background?: boolean }) => {
        try {
          const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
          if (!cwd.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          if (data.background) {
            // Run in background
            const child = spawn(data.command, [], {
              cwd,
              shell: true,
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            socket.emit('task-started', { command: data.command, pid: child.pid });
          } else {
            // Run and capture output
            const result = await this.runCommand(data.command, cwd);
            socket.emit('task-completed', {
              command: data.command,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode
            });
          }
        } catch (error) {
          socket.emit('task-error', { command: data.command, error: error instanceof Error ? error.message : String(error) });
        }
      });
    });
  }

  private listDirectoryRecursive(dirPath: string, recursive: boolean = false): any[] {
    const items: any[] = [];
    const processDir = (currentPath: string, relativePath: string) => {
      const entries = fs.readdirSync(currentPath);
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry);
        const entryRelativePath = path.join(relativePath, entry);
        const stats = fs.statSync(entryPath);

        items.push({
          name: entry,
          path: entryRelativePath,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        });

        if (recursive && stats.isDirectory()) {
          processDir(entryPath, entryRelativePath);
        }
      }
    };

    processDir(dirPath, '');
    return items;
  }

  private async runCommand(command: string, cwd: string): Promise<{ stdout: string, stderr: string, exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async searchFiles(cwd: string, query: string, include?: string, exclude?: string): Promise<any[]> {
    const results: any[] = [];

    const searchInDir = (dirPath: string, relativePath: string) => {
      try {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry);
          const entryRelativePath = path.join(relativePath, entry);
          const stats = fs.statSync(entryPath);

          // Check include/exclude patterns
          if (include && !entry.match(new RegExp(include))) continue;
          if (exclude && entry.match(new RegExp(exclude))) continue;

          if (stats.isFile()) {
            try {
              const content = fs.readFileSync(entryPath, 'utf8');
              const lines = content.split('\n');
              const matches: any[] = [];

              lines.forEach((line, index) => {
                if (line.includes(query)) {
                  matches.push({
                    line: index + 1,
                    content: line.trim(),
                    preview: line.substring(Math.max(0, line.indexOf(query) - 20), line.indexOf(query) + query.length + 20)
                  });
                }
              });

              if (matches.length > 0) {
                results.push({
                  file: entryRelativePath,
                  matches
                });
              }
            } catch (error) {
              // Skip binary files or files that can't be read
            }
          } else if (stats.isDirectory()) {
            searchInDir(entryPath, entryRelativePath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    searchInDir(cwd, '');
    return results;
  }

  private cleanupTerminals(socketId: string) {
    for (const [id, terminal] of this.terminals.entries()) {
      if (terminal.socket.id === socketId) {
        terminal.pty.kill();
        this.terminals.delete(id);
      }
    }
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        workspace: this.workspaceRoot,
        port: PORT,
        activeTerminals: this.terminals.size,
        uptime: process.uptime()
      });
    });

    // File serving
    this.app.get('/files/*', (req: express.Request, res: express.Response) => {
      const { 0: fileParam } = req.params as { 0: string };
      const filePath = path.resolve(this.workspaceRoot, fileParam);
      if (!filePath.startsWith(this.workspaceRoot)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    });

    // API routes
    this.app.get('/api/files', (req, res) => {
      try {
        const dirPath = req.query.path as string || '';
        const recursive = req.query.recursive === 'true';
        const fullPath = path.resolve(this.workspaceRoot, dirPath);

        if (!fullPath.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const items = this.listDirectoryRecursive(fullPath, recursive);
        res.json({ items });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Git operations via REST API
    this.app.get('/api/git/status', async (req, res) => {
      try {
        const cwd = req.query.cwd as string || this.workspaceRoot;
        if (!cwd.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const result = await this.runCommand('git status --porcelain', cwd);
        res.json({ status: result.stdout, cwd });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/git/commit', async (req, res) => {
      try {
        const { message, files, cwd } = req.body;
        const workDir = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;

        if (!workDir.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Add files if specified
        if (files && files.length > 0) {
          await this.runCommand(`git add ${files.join(' ')}`, workDir);
        }

        // Commit
        const result = await this.runCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`, workDir);
        res.json({ result: result.stdout, cwd });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Task execution via REST API
    this.app.post('/api/tasks/run', async (req, res) => {
      try {
        const { command, cwd, background } = req.body;
        const workDir = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;

        if (!workDir.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        if (background) {
          // Run in background
          const child = spawn(command, [], {
            cwd: workDir,
            shell: true,
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
          res.json({ status: 'started', pid: child.pid });
        } else {
          // Run and capture output
          const result = await this.runCommand(command, workDir);
          res.json({
            status: 'completed',
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
          });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search API
    this.app.get('/api/search', async (req, res) => {
      try {
        const { query, include, exclude, cwd } = req.query as any;
        const workDir = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;

        if (!workDir.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const results = await this.searchFiles(workDir, query, include, exclude);
        res.json({ query, results, cwd });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  public start() {
    this.server.listen(PORT, HOST, () => {
      console.log(`🚀 Flare Remote Development Server running on ${HOST}:${PORT}`);
      console.log(`📁 Workspace: ${this.workspaceRoot}`);
      console.log(`🔗 WebSocket endpoint: ws://${HOST}:${PORT}`);
      console.log(`💻 Health check: http://${HOST}:${PORT}/health`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  public stop() {
    console.log('🛑 Shutting down Flare Remote Development Server...');

    // Clean up all terminals
    for (const terminal of this.terminals.values()) {
      terminal.pty.kill();
    }
    this.terminals.clear();

    this.watcher.close();
    this.io.close();
    this.wss.close();
    this.server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  }
}

// CLI entry point
// Start server if run directly
if (require.main === module) {
  const server = new FlareRemoteServer();
  server.start();
}

export default FlareRemoteServer;
