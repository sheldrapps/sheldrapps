// @ts-check

const { runScreenshotCli } = require('./playstore-screenshots.cjs');

runScreenshotCli('ef').catch((error) => {
  console.error(error);
  process.exit(1);
});
