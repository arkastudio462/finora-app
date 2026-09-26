const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const expo = require(path.join(root, 'app.json')).expo;

async function getRuntimeVersion() {
  try {
    const { resolveRuntimeVersionAsync } = require('expo-updates/utils/build/resolveRuntimeVersionAsync.js');
    const result = await resolveRuntimeVersionAsync(root, 'android', {}, {});
    return result.runtimeVersion || '';
  } catch (error) {
    console.warn('[release-info] runtime version tidak dihitung:', error.message);
    return '';
  }
}

async function main() {
  const outPath = process.argv[2] || path.join(root, 'artifacts', 'release-info.json');
  const sha = process.env.GITHUB_SHA || '';
  const info = {
    version: expo.version || '',
    versionCode: expo.android?.versionCode ?? null,
    runtimeVersion: await getRuntimeVersion(),
    buildNumber: Number(process.env.GITHUB_RUN_NUMBER || 0) || null,
    sha: sha ? sha.slice(0, 7) : null,
    publishedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(info, null, 2)}\n`);
  console.log(`[release-info] ${outPath}`);
  console.log(JSON.stringify(info, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
