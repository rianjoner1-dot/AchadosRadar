import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.vercel/output/static');
const port = Number(process.argv[2] ?? 4325);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2'], ['.txt', 'text/plain; charset=utf-8']
]);

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  // Vercel injects this endpoint at the edge; keep local artifact checks offline and side-effect free.
  if (pathname === '/_vercel/speed-insights/script.js') {
    response.writeHead(204, { 'cache-control': 'no-store', 'x-achados-static-artifact': 'true' }).end();
    return;
  }
  const candidate = path.resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404, { 'x-achados-static-artifact': 'true' }).end();
    return;
  }
  const files = [candidate, path.join(candidate, 'index.html')];
  for (const file of files) {
    try {
      if (!(await stat(file)).isFile()) continue;
      const body = request.method === 'HEAD' ? null : await readFile(file);
      response.writeHead(200, {
        'content-type': contentTypes.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
        'content-length': (await stat(file)).size,
        'cache-control': 'no-cache',
        'x-achados-static-artifact': 'true'
      }).end(body);
      return;
    } catch { /* try the next path candidate */ }
  }
  response.writeHead(404, { 'x-achados-static-artifact': 'true' }).end();
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}`));
