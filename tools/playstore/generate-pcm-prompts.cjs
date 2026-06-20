// @ts-check

const { runPromptCli } = require('./playstore-prompts.cjs');

runPromptCli('pcm').catch((error) => {
  console.error(error);
  process.exit(1);
});
