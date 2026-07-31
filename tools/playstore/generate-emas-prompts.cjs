// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');

runPromptCli('emas').catch((error) => {
  console.error(error);
  process.exit(1);
});
