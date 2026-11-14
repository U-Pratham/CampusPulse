/**
 * CampusPulse - Full-Stack HTTP REST API & Application Server
 * 
 * Powered by Node.js and native SQLite (node:sqlite DatabaseSync).
 * Serves deterministic impact engine endpoints and responsive client assets.
 */

const http = require('node:http');
const { URL } = require('node:url');
const { handleApi } = require('./api.js');
const { serveStatic } = require('./staticServer.js');
const { getDb, DB_PATH } = require('./db.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Ensure DB is initialized
getDb();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    let bodyRaw = '';
    req.on('data', chunk => {
      bodyRaw += chunk;
      // Safety limit: 10MB payload (allows base64 photo attachments)
      if (bodyRaw.length > 10 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      let body = null;
      if (bodyRaw) {
        try {
          body = JSON.parse(bodyRaw);
        } catch (e) {
          body = {};
        }
      }
      handleApi(req, res, parsedUrl, body);
    });
  } else {
    serveStatic(req, res, pathname);
  }
});

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    server.listen(port, HOST, () => {
      const banner = `
======================================================================
⚡ CAMPUSPULSE FULL-STACK BACKEND SERVER ACTIVE
======================================================================
  🌐 Application URL:    http://localhost:${port}/
  🔌 REST API Base:      http://localhost:${port}/api/
  💾 Database Engine:    Native SQLite 3 (node:sqlite)
  📁 Database File:      ${DB_PATH}
  🛡️ Auth System:        Token-Based RBAC (Student & Facility Admin)
  📊 Prioritization:     Multi-Factor Deterministic Impact Engine 2.0
======================================================================
`;
      console.log(banner);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying port ${port + 1}...`);
        startServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer
};
