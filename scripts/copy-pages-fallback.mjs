import { access, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
const indexPath = resolve(dist, 'index.html');
const fallbackPath = resolve(dist, '404.html');

// Keep this list aligned with App.jsx routes. These files affect only static
// hosting resolution; BrowserRouter remains the runtime source of truth.
const directRoutes = [
  'one-v-one',
  'game',
  'results',
  'admin',
  'tournament',
  'team-battle',
  'daily',
  'how-to-play',
];

await access(indexPath);
await copyFile(indexPath, fallbackPath);

for (const route of directRoutes) {
  const routeDir = resolve(dist, route);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexPath, resolve(routeDir, 'index.html'));
}

console.log(`[Pages] Created dist/404.html and ${directRoutes.length} route entry documents for BrowserRouter deep links.`);
