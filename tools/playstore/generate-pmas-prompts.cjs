// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');

runPromptCli('pmas').catch((error) => {
  console.error(error);
  process.exit(1);
});
