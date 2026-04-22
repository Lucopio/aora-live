const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname);

const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json',
  '.ico':'image/x-icon', '.mp4':'video/mp4', '.webp':'image/webp' };

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const file = path.join(root, url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + file); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(3000, () => console.log('Serving ' + root + ' on :3000'));
