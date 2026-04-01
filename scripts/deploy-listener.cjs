const http = require('http');
const { execFile } = require('child_process');

const PORT = 9877;
const SCRIPT = '/home/jer/games/scripts/deploy.sh';

http
  .createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      return res.end('Method not allowed');
    }
    execFile(SCRIPT, { timeout: 300000 }, (error, stdout, stderr) => {
      const code = error ? error.code || 1 : 0;
      res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code, stdout, stderr: stderr || error?.message }));
    });
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`Deploy listener on http://0.0.0.0:${PORT}`);
  });
