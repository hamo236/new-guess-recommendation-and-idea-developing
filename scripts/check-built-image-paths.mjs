import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const expectedBase = process.env.EXPECTED_IMAGE_BASE || '/new-guess-recommendation-and-idea-developing/';
const jsFiles = readdirSync('dist/assets').filter((file) => file.endsWith('.js'));
const bundle = jsFiles.map((file) => readFileSync(join('dist/assets', file), 'utf8')).join('\n');
const baseLiteral = JSON.stringify(expectedBase);
const hasBaseLiteral = bundle.includes(baseLiteral);
const hasBaseResolver = bundle.includes('startsWith("/")') && bundle.includes('replace(/\\/$/,"")');
const hasCompiledImageResolver = /image:[A-Za-z_$][\w$]*\([A-Za-z_$][\w$]*\.image\)/.test(bundle);
const hasCategoryData = bundle.includes('CARTOONS:') && bundle.includes('FOOTBALL:') && bundle.includes('SPORTS:') && bundle.includes('ANIMALS:');
const hasItemData = bundle.includes('image:"/images/') && bundle.includes('category:');

if (!hasBaseLiteral) {
  throw new Error(`Built bundle is missing Vite base literal: ${expectedBase}`);
}
if (!hasBaseResolver || !hasCompiledImageResolver || !hasCategoryData || !hasItemData) {
  throw new Error('Built bundle is missing the compiled image base resolver wiring');
}

console.log(`Built image path regression passed: ${expectedBase} resolver is compiled for category and item images`);
