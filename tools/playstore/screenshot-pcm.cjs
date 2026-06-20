// @ts-check

const { runScreenshotCli } = require('./playstore-screenshots.cjs');

runScreenshotCli('pcm').catch((error) => {
  console.error(error);
  process.exit(1);
});
