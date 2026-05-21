const fs = require('fs');
const { execSync } = require('child_process');

const content = fs.readFileSync('src/lang/locale/en.ts', 'utf8');
const lines = content.split('\n');
const keyRegex = /^\s{2}([A-Z0-9_]+):/;
const keys = [];

for (const line of lines) {
    const match = line.match(keyRegex);
    if (match) {
        keys.push(match[1]);
    }
}

if (keys.length === 0) {
    console.error('No keys found');
    process.exit(1);
}

const unusedKeys = [];
for (const key of keys) {
    try {
        const cmd = 'rg -w -F "' + key + '" . -g "!src/lang/locale/*.ts" -g "!dist/**" -g "!lib/**" -g "!node_modules/**"';
        execSync(cmd, { stdio: 'ignore' });
    } catch (e) {
        unusedKeys.push(key);
    }
}

unusedKeys.sort().forEach(k => console.log(k));
console.log('Total: ' + unusedKeys.length);
