// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');
const { runScreenshotCli } = require('./playstore-screenshots.cjs');

async function main() {
  const argv = process.argv.slice(2);
  await runPromptCli('ef', argv);
  await runScreenshotCli('ef', argv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
