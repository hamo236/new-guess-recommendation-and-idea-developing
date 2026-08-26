import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
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

await access(resolve(dist, 'index.html'));
await access(resolve(dist, '404.html'));

for (const route of directRoutes) {
  await access(resolve(dist, route, 'index.html'));
}

console.log(`Pages route contract passed: ${directRoutes.length} direct routes have static entry documents.`);
