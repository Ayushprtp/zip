#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const chokidar_1 = __importDefault(require("chokidar"));
const ws_1 = require("ws");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const pty = __importStar(require("node-pty"));
const PORT = process.env.PORT || 37507;
const HOST = process.env.HOST || '127.0.0.1';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
class FlareRemoteServer {
    constructor() {
        this.terminals = new Map();
        this.workspaceRoot = WORKSPACE_ROOT;
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.watcher = chokidar_1.default.watch(this.workspaceRoot, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });
        this.setupMiddleware();
        this.setupWebSocket();
        this.setupFileWatcher();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.static(path.join(__dirname, 'public')));
    }
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                // Clean up any terminals for this socket
                this.cleanupTerminals(socket.id);
            });
            // File operations
            socket.on('read-file', async (data) => {
                try {
                    const filePath = path.resolve(this.workspaceRoot, data.path);
                    if (!filePath.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const encoding = data.encoding || 'utf8';
                    const content = fs.readFileSync(filePath, encoding);
                    socket.emit('file-content', { path: data.path, content, encoding });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('write-file', async (data) => {
                try {
                    const filePath = path.resolve(this.workspaceRoot, data.path);
                    if (!filePath.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const encoding = data.encoding || 'utf8';
                    fs.writeFileSync(filePath, data.content, encoding);
                    socket.emit('file-saved', { path: data.path });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('create-file', async (data) => {
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
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('delete-file', async (data) => {
                try {
                    const filePath = path.resolve(this.workspaceRoot, data.path);
                    if (!filePath.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory() && data.recursive) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    }
                    else if (stats.isFile()) {
                        fs.unlinkSync(filePath);
                    }
                    else {
                        throw new Error('Cannot delete directory without recursive flag');
                    }
                    socket.emit('file-deleted', { path: data.path });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('rename-file', async (data) => {
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
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('list-directory', async (data) => {
                try {
                    const dirPath = path.resolve(this.workspaceRoot, data.path || '');
                    if (!dirPath.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const items = this.listDirectoryRecursive(dirPath, data.recursive || false);
                    socket.emit('directory-listing', { path: data.path, items });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            // Terminal operations
            socket.on('create-terminal', async (data) => {
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
                    const terminalSession = {
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
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('terminal-input', (data) => {
                const terminal = this.terminals.get(data.id);
                if (terminal) {
                    terminal.pty.write(data.input);
                }
            });
            socket.on('resize-terminal', (data) => {
                const terminal = this.terminals.get(data.id);
                if (terminal) {
                    terminal.pty.resize(data.cols, data.rows);
                }
            });
            socket.on('close-terminal', (data) => {
                const terminal = this.terminals.get(data.id);
                if (terminal) {
                    terminal.pty.kill();
                    this.terminals.delete(data.id);
                }
            });
            // Git operations
            socket.on('git-status', async (data) => {
                try {
                    const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
                    if (!cwd.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const result = await this.runCommand('git status --porcelain', cwd);
                    socket.emit('git-status-result', { status: result.stdout, cwd: data.cwd });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            socket.on('git-commit', async (data) => {
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
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            // Search operations
            socket.on('search-files', async (data) => {
                try {
                    const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
                    if (!cwd.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    const results = await this.searchFiles(cwd, data.query, data.include, data.exclude);
                    socket.emit('search-results', { query: data.query, results, cwd: data.cwd });
                }
                catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            // Task running
            socket.on('run-task', async (data) => {
                try {
                    const cwd = data.cwd ? path.resolve(this.workspaceRoot, data.cwd) : this.workspaceRoot;
                    if (!cwd.startsWith(this.workspaceRoot)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }
                    if (data.background) {
                        // Run in background
                        const child = (0, child_process_1.spawn)(data.command, [], {
                            cwd,
                            shell: true,
                            detached: true,
                            stdio: 'ignore'
                        });
                        child.unref();
                        socket.emit('task-started', { command: data.command, pid: child.pid });
                    }
                    else {
                        // Run and capture output
                        const result = await this.runCommand(data.command, cwd);
                        socket.emit('task-completed', {
                            command: data.command,
                            stdout: result.stdout,
                            stderr: result.stderr,
                            exitCode: result.exitCode
                        });
                    }
                }
                finally {
                }
            }, private, listDirectoryRecursive(dirPath, string, recursive, boolean = false), any[], {
                const: items, any, []:  = [],
                const: processDir = (currentPath, relativePath) => {
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
                },
                return: items
            }, private, async, runCommand(command, string, cwd, string), Promise < { stdout: string, stderr: string, exitCode: number } > {
                return: new Promise((resolve, reject) => {
                    const child = (0, child_process_1.spawn)(command, [], {
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
                })
            }, private, async, searchFiles(cwd, string, query, string, include ?  : string, exclude ?  : string), Promise < any[] > {
                const: results, any, []:  = [],
                const: searchInDir = (dirPath, relativePath) => {
                    try {
                        const entries = fs.readdirSync(dirPath);
                        for (const entry of entries) {
                            const entryPath = path.join(dirPath, entry);
                            const entryRelativePath = path.join(relativePath, entry);
                            const stats = fs.statSync(entryPath);
                            // Check include/exclude patterns
                            if (include && !entry.match(new RegExp(include)))
                                continue;
                            if (exclude && entry.match(new RegExp(exclude)))
                                continue;
                            if (stats.isFile()) {
                                try {
                                    const content = fs.readFileSync(entryPath, 'utf8');
                                    const lines = content.split('\n');
                                    const matches = [];
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
                                }
                                catch (error) {
                                    // Skip binary files or files that can't be read
                                }
                            }
                            else if (stats.isDirectory()) {
                                searchInDir(entryPath, entryRelativePath);
                            }
                        }
                    }
                    catch (error) {
                        // Skip directories we can't read
                    }
                },
                return: results
            }, private, cleanupTerminals(socketId, string), {
                : .terminals.entries()
            });
            {
                if (terminal.socket.id === socketId) {
                    terminal.pty.kill();
                    this.terminals.delete(id);
                }
            }
        }, private, setupRoutes(), {
            // Health check
            this: .app.get('/health', (req, res) => {
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    workspace: this.workspaceRoot,
                    port: PORT,
                    activeTerminals: this.terminals.size,
                    uptime: process.uptime()
                });
            }),
            // File serving
            this: .app.get('/files/*', (req, res) => {
                const filePath = path.resolve(this.workspaceRoot, req.params[0]);
                if (!filePath.startsWith(this.workspaceRoot)) {
                    return res.status(403).json({ error: 'Access denied' });
                }
                if (fs.existsSync(filePath)) {
                    res.sendFile(filePath);
                }
                else {
                    res.status(404).json({ error: 'File not found' });
                }
            }),
            // API routes
            this: .app.get('/api/files', (req, res) => {
                try {
                    const dirPath = req.query.path || '';
                    const recursive = req.query.recursive === 'true';
                    const fullPath = path.resolve(this.workspaceRoot, dirPath);
                    if (!fullPath.startsWith(this.workspaceRoot)) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    const items = this.listDirectoryRecursive(fullPath, recursive);
                    res.json({ items });
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }),
            // Git operations via REST API
            this: .app.get('/api/git/status', async (req, res) => {
                try {
                    const cwd = req.query.cwd || this.workspaceRoot;
                    if (!cwd.startsWith(this.workspaceRoot)) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    const result = await this.runCommand('git status --porcelain', cwd);
                    res.json({ status: result.stdout, cwd });
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }),
            this: .app.post('/api/git/commit', async (req, res) => {
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
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }),
            // Task execution via REST API
            this: .app.post('/api/tasks/run', async (req, res) => {
                try {
                    const { command, cwd, background } = req.body;
                    const workDir = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;
                    if (!workDir.startsWith(this.workspaceRoot)) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    if (background) {
                        // Run in background
                        const child = (0, child_process_1.spawn)(command, [], {
                            cwd: workDir,
                            shell: true,
                            detached: true,
                            stdio: 'ignore'
                        });
                        child.unref();
                        res.json({ status: 'started', pid: child.pid });
                    }
                    else {
                        // Run and capture output
                        const result = await this.runCommand(command, workDir);
                        res.json({
                            status: 'completed',
                            stdout: result.stdout,
                            stderr: result.stderr,
                            exitCode: result.exitCode
                        });
                    }
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }),
            // Search API
            this: .app.get('/api/search', async (req, res) => {
                try {
                    const { query, include, exclude, cwd } = req.query;
                    const workDir = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;
                    if (!workDir.startsWith(this.workspaceRoot)) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    const results = await this.searchFiles(workDir, query, include, exclude);
                    res.json({ query, results, cwd });
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            })
        }, public, start(), {
            this: .server.listen(PORT, HOST, () => {
                console.log(`🚀 Flare Remote Development Server running on ${HOST}:${PORT}`);
                console.log(`📁 Workspace: ${this.workspaceRoot}`);
                console.log(`🔗 WebSocket endpoint: ws://${HOST}:${PORT}`);
                console.log(`💻 Health check: http://${HOST}:${PORT}/health`);
            }),
            // Handle graceful shutdown
            process, : .on('SIGINT', () => this.stop()),
            process, : .on('SIGTERM', () => this.stop())
        }, public, stop(), {
            console, : .log('🛑 Shutting down Flare Remote Development Server...'),
            : .terminals.values()
        });
        {
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
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new FlareRemoteServer();
    server.start();
}
exports.default = FlareRemoteServer;
