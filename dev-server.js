/**
 * Development Server - Cloud-Based Bus Pass System
 * Zero-dependency local server with automatic port-in-use detection.
 * Run with: npm run dev  OR  node dev-server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let port = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Normalize URL path
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    // Prevent directory traversal attacks
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.end('Access Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.statusCode = 404;
                res.end('File Not Found');
            } else {
                res.statusCode = 500;
                res.end(`Internal Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function startServer(targetPort) {
    server.listen(targetPort, () => {
        console.log(`\n======================================================`);
        console.log(` SkyRoute Cloud Server successfully running!`);
        console.log(` Local URL: http://localhost:${targetPort}`);
        console.log(` Press Ctrl+C to terminate server connection`);
        console.log(`======================================================\n`);
    });
}

// Handle port occupied errors automatically
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is currently in use. Trying port ${port + 1}...`);
        port++;
        startServer(port);
    } else {
        console.error('Server error:', err);
    }
});

startServer(port);
