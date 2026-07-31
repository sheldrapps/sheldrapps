// @ts-check

const { runScreenshotCli } = require('./playstore-screenshots.cjs');

runScreenshotCli('emas').catch((error) => {
  console.error(error);
  process.exit(1);
});
