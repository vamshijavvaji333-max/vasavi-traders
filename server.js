const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || '8080', 10);
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // Add basic CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname || '/');

  // URL normalization & route shortcuts
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (pathname === '/audit') {
    pathname = '/audit.html';
  }

  const filePath = path.normalize(path.join(BASE_DIR, pathname));

  // Security check: ensure file is inside BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc;">
  <h2>404 - File Not Found</h2>
  <p>The requested file <code>${pathname}</code> was not found.</p>
  <p>Available pages: <a href="/" style="color: #38bdf8;">Home (index.html)</a> | <a href="/audit.html" style="color: #34d399;">Audit Portal (audit.html)</a></p>
</body>
</html>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Vasavi Traders Web Server is running with Node/NPM!`);
  console.log(` Port: ${PORT}`);
  console.log(` - Main Portal:   http://localhost:${PORT}/`);
  console.log(` - Audit Portal:  http://localhost:${PORT}/audit.html`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = PORT + 1;
    console.warn(`Port ${PORT} in use, attempting fallback to port ${fallbackPort}...`);
    server.listen(fallbackPort, '0.0.0.0', () => {
      console.log(`Server started on fallback port http://localhost:${fallbackPort}/`);
    });
  } else {
    console.error('Server error:', err);
  }
});
