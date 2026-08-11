// @ts-check

const { runScreenshotCli } = require('./playstore-screenshots.cjs');

runScreenshotCli('pmas').catch((error) => {
  console.error(error);
  process.exit(1);
});
