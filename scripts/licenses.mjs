import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const inventory = [];
const notices = [
  '# Dependency license notices\n\nGenerated from installed dependency packages. These notices do not license the original application source.\n',
];
for (const [dir, entry] of Object.entries(lock.packages)) {
  if (!dir || !dir.startsWith('node_modules/')) continue;
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    inventory.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license ?? entry.license ?? 'See package notices',
      development: Boolean(entry.dev),
    });
    const files = (await readdir(dir)).filter((f) => /^(licen[sc]e|notice|copying)(\.|$)/i.test(f));
    for (const file of files) {
      try {
        notices.push(
          `\n## ${pkg.name}@${pkg.version} — ${file}\n\n\`\`\`text\n${await readFile(path.join(dir, file), 'utf8')}\n\`\`\`\n`,
        );
      } catch {}
    }
  } catch {}
}
await mkdir('licenses', { recursive: true });
await writeFile('licenses/dependency-inventory.json', JSON.stringify(inventory, null, 2));
await writeFile('licenses/DEPENDENCY_NOTICES.md', notices.join('\n'));
console.log(`Recorded ${inventory.length} installed package licenses.`);
