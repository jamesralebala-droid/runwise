import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname;

  // Serve early-access.html at root /
  if (filePath === '/' || filePath === '') {
    filePath = '/early-access.html';
  }

  const fullPath = path.join(ROOT, filePath);
  const ext = path.extname(filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // Try clean URL: if /some-page, look for some-page.html
      if (!ext) {
        const htmlPath = fullPath + '.html';
        fs.readFile(htmlPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving early-access at http://0.0.0.0:${PORT}/`);
});
