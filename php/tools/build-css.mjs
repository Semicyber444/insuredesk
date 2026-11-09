// Rebuilds public/assets/app.css after view classes change. Run from the repo root (uses its node_modules):
//   node php/tools/build-css.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const php = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(php, 'tools/app.src.css');
const compiler = await compile(readFileSync(source, 'utf8'), { base: path.dirname(source), onDependency: () => {} });
const scanner = new Scanner({ sources: ['views', 'public/assets', 'src'].map((dir) => ({ base: path.join(php, dir), pattern: '**/*.{php,js}', negated: false })) });
writeFileSync(path.join(php, 'public/assets/app.css'), compiler.build(scanner.scan()));
