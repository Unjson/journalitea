import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const sourceFile = path.join(root, 'src', 'sfx', 'singing-bowl.ogg');
const targetDir = path.join(root, 'dist-electron', 'sfx');
const targetFile = path.join(targetDir, 'singing-bowl.ogg');
const windowIconSourceFile = path.join(root, 'src', 'img', 'app-icons', 'desktop', 'icon_16.png');
const windowIconTargetDir = path.join(root, 'dist-electron', 'app-icons');
const windowIconTargetFile = path.join(windowIconTargetDir, 'icon_16.png');

await mkdir(targetDir, { recursive: true });
await copyFile(sourceFile, targetFile);
await mkdir(windowIconTargetDir, { recursive: true });
await copyFile(windowIconSourceFile, windowIconTargetFile);

console.log('Copied singing-bowl.ogg to dist-electron.');
console.log('Copied window icon to dist-electron.');
