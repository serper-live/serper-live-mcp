// Copies the package.json version into server.json (both fields) and manifest.json. Runs as the npm "version" script,
// so `npm version x.y.z --no-git-tag-version` updates every place the publish workflow checks.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

update('server.json', data => {
    data.version = version;
    data.packages[0].version = version;
});
update('manifest.json', data => {
    data.version = version;
});

function update(file, change) {
    const data = JSON.parse(readFileSync(file, 'utf8'));

    change(data);
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}