const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const appDir = process.cwd();
const androidDir = path.join(appDir, 'android');
const env = { ...process.env };

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(args, cwd) {
  const pnpmExecPath = process.env.npm_execpath;

  if (!pnpmExecPath) {
    throw new Error('run-mobile-android-flow.cjs must be launched through pnpm');
  }

  run(process.execPath, [pnpmExecPath, ...args], cwd);
}

function parseArgs(argv) {
  const options = {
    gradleTask: argv[0],
    copyApk: null,
    copyTo: null,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--copy-apk') {
      options.copyApk = argv[++index];
      continue;
    }

    if (current === '--copy-to') {
      options.copyTo = argv[++index];
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

function copyArtifact(copyApk, copyTo) {
  if (!copyApk || !copyTo) {
    throw new Error('Both --copy-apk and --copy-to are required when copying an artifact.');
  }

  const sourcePath = path.resolve(androidDir, copyApk);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`APK not found at: ${sourcePath}`);
  }

  const destinationRoot = path.resolve(appDir, copyTo);
  const destinationIsDir =
    /[\\/]$/.test(copyTo) || (fs.existsSync(destinationRoot) && fs.statSync(destinationRoot).isDirectory());
  const destinationPath = destinationIsDir
    ? path.join(destinationRoot, path.basename(sourcePath))
    : destinationRoot;

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

const { gradleTask, copyApk, copyTo } = parseArgs(process.argv.slice(2));

if (!gradleTask) {
  throw new Error('Usage: node run-mobile-android-flow.cjs <gradleTask> [--copy-apk <relative-path>] [--copy-to <path>]');
}

runPnpm(['build'], appDir);
runPnpm(['exec', 'cap', 'sync', 'android'], appDir);
run(process.execPath, [path.join(repoRoot, 'scripts', 'patch-cordova-flatdir.cjs')], appDir);

const gradleCommand = process.platform === 'win32' ? 'cmd.exe' : path.join(androidDir, 'gradlew');
const gradleArgs =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `.\\gradlew.bat clean ${gradleTask}`]
    : ['clean', gradleTask];

run(gradleCommand, gradleArgs, androidDir);

if (copyApk && copyTo) {
  copyArtifact(copyApk, copyTo);
}
