// @ts-check

const { runScreenshotCli } = require('./playstore-screenshots.cjs');

runScreenshotCli('ecc').catch((error) => {
  console.error(error);
  process.exit(1);
});
