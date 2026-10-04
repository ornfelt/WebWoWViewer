// Fails (exit 1) when any .js file exists under js/application, listing them: the TypeScript branch has
// TypeScript sources only. A node script instead of `! find ... | grep .`, so it also runs from cmd.exe,
// which npm uses for its scripts on Windows.
import { readdirSync } from 'node:fs';
import path from 'node:path';

function findJs(dir) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...findJs(full));
        else if (entry.name.endsWith('.js')) found.push(full);
    }
    return found;
}

const jsFiles = findJs('js/application');
for (const file of jsFiles) console.log(file.split(path.sep).join('/'));
process.exit(jsFiles.length > 0 ? 1 : 0);
