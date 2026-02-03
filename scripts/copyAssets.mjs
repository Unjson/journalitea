import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const sourceFile = path.join(root, 'src', 'sfx', 'singing-bowl.ogg');
const targetDir = path.join(root, 'dist-electron', 'sfx');
const targetFile = path.join(targetDir, 'singing-bowl.ogg');

await mkdir(targetDir, { recursive: true });
await copyFile(sourceFile, targetFile);

console.log('Copied singing-bowl.ogg to dist-electron.');
