// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');

runPromptCli('ecc').catch((error) => {
  console.error(error);
  process.exit(1);
});
