// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');

runPromptCli('ef').catch((error) => {
  console.error(error);
  process.exit(1);
});
