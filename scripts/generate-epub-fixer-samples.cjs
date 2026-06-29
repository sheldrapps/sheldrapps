const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const requireFromEpubFixer = createRequire(
  path.join(__dirname, '..', 'apps', 'epub-fixer', 'package.json'),
);
const JSZip = requireFromEpubFixer('jszip');

const sourcePath = process.argv[2] || 'C:\\Users\\sheld\\Downloads\\el-principito.epub';
const outputDir = process.argv[3] || 'C:\\apps\\sheldrapps\\artifacts\\epub-fixer-samples';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(zip, entryPath) {
  const entry = zip.file(entryPath);
  if (!entry) {
    return null;
  }
  return entry.async('string');
}

async function writeSample(zip, destinationPath) {
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    platform: 'UNIX',
  });
  fs.writeFileSync(destinationPath, buffer);
}

async function makeSample(sourceBuffer, mutate, destinationPath) {
  const zip = await JSZip.loadAsync(sourceBuffer);
  await mutate(zip);
  await writeSample(zip, destinationPath);
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source EPUB not found: ${sourcePath}`);
  }

  ensureDir(outputDir);
  const sourceBuffer = fs.readFileSync(sourcePath);

  const samples = [
    {
      name: '12-blocking-mimetype-missing',
      description: 'Opening blocker with missing mimetype; fixer should restore application/epub+zip.',
      mutate: async (zip) => {
        zip.remove('mimetype');
      },
    },
    {
      name: '13-blocking-mimetype-invalid',
      description: 'Opening blocker with invalid mimetype content; fixer should normalize it.',
      mutate: async (zip) => {
        zip.file('mimetype', 'application/not-epub+zip', { compression: 'STORE' });
      },
    },
    {
      name: '14-blocking-container-missing',
      description: 'Opening blocker with missing META-INF/container.xml; fixer should rebuild it.',
      mutate: async (zip) => {
        zip.remove('META-INF/container.xml');
      },
    },
    {
      name: '15-blocking-container-malformed',
      description: 'Opening blocker with malformed container.xml; fixer should rewrite a valid container.',
      mutate: async (zip) => {
        const brokenContainer = [
          '<?xml version="1.0"?>',
          '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
          '   <rootfiles>',
          '      <rootfile full-path="content.opf" media-type="application/oebps-package+xml">',
          '   </rootfiles>',
          '</container>',
          '',
        ].join('\n');
        zip.file('META-INF/container.xml', brokenContainer);
      },
    },
    {
      name: '16-blocking-rootfile-missing',
      description: 'Opening blocker with no rootfile; fixer should rediscover the package document.',
      mutate: async (zip) => {
        const containerXml = await readText(zip, 'META-INF/container.xml');
        if (!containerXml) {
          return;
        }
        zip.file(
          'META-INF/container.xml',
          containerXml.replace(/<rootfile\b[^>]*\/>\s*/g, '\n'),
        );
      },
    },
    {
      name: '17-blocking-rootfile-invalid',
      description: 'Opening blocker with a bad rootfile path; fixer should resolve the correct OPF.',
      mutate: async (zip) => {
        const containerXml = await readText(zip, 'META-INF/container.xml');
        if (!containerXml) {
          return;
        }
        zip.file(
          'META-INF/container.xml',
          containerXml.replace(
            /full-path="[^"]+"/,
            'full-path="OPS/missing/content.opf"',
          ),
        );
      },
    },
  ];

  const manifest = [];
  for (const sample of samples) {
    const destinationPath = path.join(outputDir, `${sample.name}.epub`);
    await makeSample(sourceBuffer, sample.mutate, destinationPath);
    manifest.push({
      name: sample.name,
      description: sample.description,
      file: destinationPath,
    });
  }

  fs.writeFileSync(
    path.join(outputDir, 'samples.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  fs.writeFileSync(
    path.join(outputDir, 'README.md'),
    [
      '# EPUB Fixer samples',
      '',
      'Source: el-principito.epub',
      '',
      'Generated samples:',
      '- 12-blocking-mimetype-missing: Opening blocker with missing mimetype; fixer should restore it',
      '- 13-blocking-mimetype-invalid: Opening blocker with invalid mimetype content; fixer should normalize it',
      '- 14-blocking-container-missing: Opening blocker with missing `META-INF/container.xml`; fixer should rebuild it',
      '- 15-blocking-container-malformed: Opening blocker with malformed `container.xml`; fixer should rewrite it',
      '- 16-blocking-rootfile-missing: Opening blocker with no `rootfile`; fixer should rediscover the package document',
      '- 17-blocking-rootfile-invalid: Opening blocker with a bad `rootfile` path; fixer should resolve the correct OPF',
      '',
      'Notes:',
      '- 12-17 are derived from el-principito.epub and are intended to block opening in readers while remaining repairable by EPUB Fixer.',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Generated ${samples.length} samples in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
