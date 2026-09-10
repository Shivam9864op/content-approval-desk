import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard } from './core.mjs';

const fixturePath = process.argv[2] || 'fixtures/campaign.json';
const root = fileURLToPath(new URL('..', import.meta.url));
const board = buildBoard(JSON.parse(await readFile(join(root, fixturePath), 'utf8')));
const publicDir = join(root, 'public');

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/board') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(board));
      return;
    }
    const file = request.url?.startsWith('/review/') ? 'index.html' : 'index.html';
    const body = await readFile(join(publicDir, file));
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'text/plain; charset=utf-8' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(4173, '127.0.0.1', () => {
  console.log('Content Approval Desk running at http://127.0.0.1:4173');
});
