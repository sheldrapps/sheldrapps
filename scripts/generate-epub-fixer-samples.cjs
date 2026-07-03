const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const requireFromEpubFixer = createRequire(
  path.join(__dirname, '..', 'apps', 'epub-fixer', 'package.json'),
);
const JSZip = requireFromEpubFixer('jszip');

const sourcePath =
  process.argv[2] || 'C:\\Users\\sheld\\Downloads\\el-gato-negro--3.epub';
const outputDir =
  process.argv[3] || 'C:\\apps\\sheldrapps\\artifacts\\epub-fixer-samples';
const workspaceRoot = path.resolve(__dirname, '..');

function normalizePath(value) {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

function ensureSafeOutputDir(dirPath) {
  const resolvedOutputDir = path.resolve(dirPath);
  const normalizedOutputDir = normalizePath(resolvedOutputDir);
  const normalizedWorkspaceRoot = normalizePath(workspaceRoot);
  if (
    normalizedOutputDir !== normalizedWorkspaceRoot &&
    !normalizedOutputDir.startsWith(`${normalizedWorkspaceRoot}/`)
  ) {
    throw new Error(`Output dir must stay inside the workspace: ${dirPath}`);
  }
  return resolvedOutputDir;
}

function cleanOutputDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

function toBuffer(value, encoding = 'utf8') {
  return Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, encoding);
}

function cloneEntries(entries) {
  const clone = new Map();
  for (const [name, entry] of entries.entries()) {
    clone.set(name, {
      data: Buffer.from(entry.data),
      options: { ...entry.options },
    });
  }
  return clone;
}

function getText(entries, entryPath) {
  const entry = entries.get(entryPath);
  if (!entry) {
    return null;
  }
  return entry.data.toString('utf8');
}

function setText(entries, entryPath, value, options = {}) {
  entries.set(entryPath, {
    data: toBuffer(value),
    options: { ...options },
  });
}

function setBinary(entries, entryPath, value, options = {}) {
  entries.set(entryPath, {
    data: toBuffer(value),
    options: { ...options },
  });
}

function removeEntry(entries, entryPath) {
  entries.delete(entryPath);
}

function replaceText(entries, entryPath, replacer, options = {}) {
  const current = getText(entries, entryPath);
  if (current == null) {
    return;
  }
  const next = replacer(current);
  if (next != null) {
    setText(entries, entryPath, next, options);
  }
}

function replaceBinary(entries, entryPath, replacer, options = {}) {
  const current = entries.get(entryPath);
  if (!current) {
    return;
  }
  const next = replacer(Buffer.from(current.data));
  if (next != null) {
    setBinary(entries, entryPath, next, options);
  }
}

function buildOrder(baseOrder, entries, customOrder) {
  const order = [];
  const seen = new Set();
  const preferred = customOrder || baseOrder;

  for (const entryPath of preferred) {
    if (!entries.has(entryPath) || seen.has(entryPath)) {
      continue;
    }
    order.push(entryPath);
    seen.add(entryPath);
  }

  for (const entryPath of baseOrder) {
    if (!entries.has(entryPath) || seen.has(entryPath)) {
      continue;
    }
    order.push(entryPath);
    seen.add(entryPath);
  }

  const extras = [...entries.keys()].filter((entryPath) => !seen.has(entryPath));
  extras.sort((left, right) => left.localeCompare(right));
  for (const entryPath of extras) {
    order.push(entryPath);
  }

  return order;
}

async function writeZip(entries, order, destinationPath) {
  const zip = new JSZip();
  for (const entryPath of order) {
    const entry = entries.get(entryPath);
    if (!entry) {
      continue;
    }
    zip.file(entryPath, entry.data, entry.options);
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    platform: 'UNIX',
  });
  fs.writeFileSync(destinationPath, buffer);
}

async function loadSource(sourceFilePath) {
  const sourceBuffer = fs.readFileSync(sourceFilePath);
  const zip = await JSZip.loadAsync(sourceBuffer);
  const entries = new Map();
  const order = [];

  for (const entryPath of Object.keys(zip.files)) {
    const file = zip.files[entryPath];
    if (file.dir) {
      continue;
    }
    order.push(entryPath);
    entries.set(entryPath, {
      data: Buffer.from(await file.async('nodebuffer')),
      options: {},
    });
  }

  return { sourceBuffer, entries, order };
}

function writeReadme(destinationPath, sourceFilePath, samples) {
  const lines = [
    '# EPUB Fixer samples',
    '',
    `Source: ${sourceFilePath}`,
    '',
    'Generated samples:',
  ];

  for (const sample of samples) {
    lines.push(`- ${sample.name}: ${sample.description}`);
  }

  lines.push('', 'Notes:');
  lines.push(
    '- The sample set is aligned to the 33 opening blocker cases in the EPUB Fixer repair matrix.',
  );
  lines.push(
    '- Some blockers intentionally overlap in the underlying ZIP mutation, but each file is named and documented per matrix case.',
  );
  lines.push(
    '- The DRM-style blocker is represented by a locked-content placeholder sample because the repo does not mint real DRM EPUBs.',
  );
  lines.push('');

  fs.writeFileSync(destinationPath, `${lines.join('\n')}\n`, 'utf8');
}

function buildSamples(baseOpfText) {
  const samples = [
    {
      id: 'CRIT-ZIP-001',
      name: '01-crit-zip-001',
      description: 'Plain text EPUB placeholder; not a readable ZIP.',
      async build(sourceBuffer, destinationPath) {
        fs.writeFileSync(destinationPath, Buffer.from('This is not a zip archive.', 'utf8'));
      },
    },
    {
      id: 'CRIT-ZIP-002',
      name: '02-crit-zip-002',
      description: 'Truncated ZIP central directory.',
      async build(sourceBuffer, destinationPath) {
        const end = Math.max(0, sourceBuffer.length - 512);
        fs.writeFileSync(destinationPath, sourceBuffer.subarray(0, end));
      },
    },
    {
      id: 'CRIT-OCF-001',
      name: '03-crit-ocf-001',
      description: 'Missing mimetype entry.',
      mutate(entries) {
        removeEntry(entries, 'mimetype');
      },
    },
    {
      id: 'CRIT-OCF-002',
      name: '04-crit-ocf-002',
      description: 'Mimetype moved out of the first ZIP slot.',
      mutate(entries) {
        setText(entries, 'mimetype', 'application/epub+zip', { compression: 'STORE' });
      },
      order(baseOrder) {
        return [...baseOrder.filter((entryPath) => entryPath !== 'mimetype'), 'mimetype'];
      },
    },
    {
      id: 'CRIT-OCF-003',
      name: '05-crit-ocf-003',
      description: 'Mimetype stored with compression.',
      mutate(entries) {
        setText(entries, 'mimetype', 'application/epub+zip', { compression: 'DEFLATE' });
      },
    },
    {
      id: 'CRIT-OCF-004',
      name: '06-crit-ocf-004',
      description: 'Mimetype rewritten with invalid bytes.',
      mutate(entries) {
        setText(entries, 'mimetype', '\uFEFF application/not-epub+zip\n', { compression: 'STORE' });
      },
    },
    {
      id: 'CRIT-OCF-005',
      name: '07-crit-ocf-005',
      description: 'No META-INF directory remains.',
      mutate(entries) {
        removeEntry(entries, 'META-INF/container.xml');
      },
    },
    {
      id: 'CRIT-CON-001',
      name: '08-crit-con-001',
      description: 'Missing META-INF/container.xml.',
      mutate(entries) {
        removeEntry(entries, 'META-INF/container.xml');
      },
    },
    {
      id: 'CRIT-CON-002',
      name: '09-crit-con-002',
      description: 'Malformed container.xml.',
      mutate(entries) {
        setText(
          entries,
          'META-INF/container.xml',
          [
            '<?xml version="1.0"?>',
            '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
            '  <rootfiles>',
            '    <rootfile full-path="content.opf" media-type="application/oebps-package+xml">',
            '  </rootfilesX>',
            '</container>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'CRIT-CON-003',
      name: '10-crit-con-003',
      description: 'container.xml without a rootfile.',
      mutate(entries) {
        setText(
          entries,
          'META-INF/container.xml',
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
            '  <rootfiles>',
            '  </rootfiles>',
            '</container>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'CRIT-CON-004',
      name: '11-crit-con-004',
      description: 'rootfile path points to a missing OPF.',
      mutate(entries) {
        replaceText(entries, 'META-INF/container.xml', (text) =>
          text.replace('full-path="content.opf"', 'full-path="OPS/missing/content.opf"'),
        );
        removeEntry(entries, 'content.opf');
      },
    },
    {
      id: 'CRIT-CON-005',
      name: '12-crit-con-005',
      description: 'Multiple OPF candidates with no clear winner.',
      mutate(entries) {
        removeEntry(entries, 'META-INF/container.xml');
        removeEntry(entries, 'content.opf');
        setText(entries, 'OPS/content.opf', baseOpfText);
        setText(entries, 'OEBPS/content.opf', baseOpfText);
      },
    },
    {
      id: 'CRIT-OPF-001',
      name: '13-crit-opf-001',
      description: 'No OPF is localizable from the container.',
      mutate(entries) {
        replaceText(entries, 'META-INF/container.xml', (text) =>
          text.replace('full-path="content.opf"', 'full-path="OPS/missing/content.opf"'),
        );
        removeEntry(entries, 'content.opf');
      },
    },
    {
      id: 'CRIT-OPF-002',
      name: '14-crit-opf-002',
      description: 'OPF is malformed XML.',
      mutate(entries) {
        setText(
          entries,
          'content.opf',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="2.0">',
            '  <metadata xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:calibre="http://calibre.kovidgoyal.net/2009/metadata" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
            '    <dc:title>El Gato Negro',
            '  </metadata>',
            '  <manifest>',
            '    <item href="images/freeditorial_New_Logo.jpeg" id="id3" media-type="image/jpeg"/>',
            '  </manifest>',
            '</package>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'CRIT-OPF-003',
      name: '15-crit-opf-003',
      description: 'manifest element removed.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace(/<manifest>[\s\S]*?<\/manifest>\s*/m, ''),
        );
      },
    },
    {
      id: 'CRIT-OPF-004',
      name: '16-crit-opf-004',
      description: 'spine element removed.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace(/<spine[^>]*>[\s\S]*?<\/spine>\s*/m, ''),
        );
      },
    },
    {
      id: 'CRIT-OPF-005',
      name: '17-crit-opf-005',
      description: 'spine exists but is empty.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace(
            /<spine([^>]*)>[\s\S]*?<\/spine>/m,
            '<spine$1>\n  </spine>',
          ),
        );
      },
    },
    {
      id: 'CRIT-SPINE-001',
      name: '18-crit-spine-001',
      description: 'spine idref points to a missing manifest id.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) => text.replace('idref="id12"', 'idref="missing-id"'));
      },
    },
    {
      id: 'CRIT-SPINE-002',
      name: '19-crit-spine-002',
      description: 'Referenced chapter file removed from ZIP.',
      mutate(entries) {
        removeEntry(entries, 'index_split_001.html');
      },
    },
    {
      id: 'CRIT-SPINE-003',
      name: '20-crit-spine-003',
      description: 'spine points at a non-reading resource.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) => {
          const next = text.replace('idref="id11"', 'idref="id3"');
          return next.replace('idref="id12"', 'idref="id12"');
        });
      },
    },
    {
      id: 'CRIT-XHTML-001',
      name: '21-crit-xhtml-001',
      description: 'Chapter XHTML is malformed.',
      mutate(entries) {
        setText(
          entries,
          'index_split_001.html',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>El Gato Negro</title>',
            '  <body class="calibre">',
            '    <p>Unclosed paragraph',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'CRIT-SEC-001',
      name: '22-crit-sec-001',
      description: 'DRM-style locked content placeholder.',
      mutate(entries) {
        setText(
          entries,
          'META-INF/encryption.xml',
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
            '  <EncryptedData>',
            '    <CipherData>LOCKED</CipherData>',
            '  </EncryptedData>',
            '</encryption>',
            '',
          ].join('\n'),
        );
        setText(
          entries,
          'META-INF/rights.xml',
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<rights xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
            '  <locked>true</locked>',
            '</rights>',
            '',
          ].join('\n'),
        );
        setBinary(entries, 'index_split_001.html', Buffer.from('LOCKED CONTENT PLACEHOLDER', 'utf8'));
      },
    },
    {
      id: 'HIGH-OPF-001',
      name: '23-high-opf-001',
      description: 'OPF version is invalid.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace('version="2.0"', 'version="banana"'),
        );
      },
    },
    {
      id: 'HIGH-OPF-002',
      name: '24-high-opf-002',
      description: 'unique-identifier removed.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace(' unique-identifier="uuid_id"', ''),
        );
      },
    },
    {
      id: 'HIGH-OPF-003',
      name: '25-high-opf-003',
      description: 'unique-identifier points to a missing id.',
      mutate(entries) {
        replaceText(entries, 'content.opf', (text) =>
          text.replace('unique-identifier="uuid_id"', 'unique-identifier="missing_id"'),
        );
      },
    },
    {
      id: 'HIGH-MAN-001',
      name: '26-high-man-001',
      description: 'Physical orphan file added outside manifest.',
      mutate(entries) {
        setText(entries, 'images/orphan_cover.jpg', 'orphan image placeholder');
      },
    },
    {
      id: 'HIGH-MAN-002',
      name: '27-high-man-002',
      description: 'Manifest references a missing image.',
      mutate(entries) {
        removeEntry(entries, 'images/freeditorial_New_Logo.jpeg');
      },
    },
    {
      id: 'HIGH-XHTML-001',
      name: '28-high-xhtml-001',
      description: 'Chapter XHTML has unclosed tags.',
      mutate(entries) {
        setText(
          entries,
          'index_split_001.html',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>El Gato Negro</title>',
            '  </head>',
            '  <body class="calibre">',
            '    <div><p>Broken nesting',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'HIGH-XHTML-002',
      name: '29-high-xhtml-002',
      description: 'Chapter XHTML uses invalid XML syntax.',
      mutate(entries) {
        setText(
          entries,
          'index_split_001.html',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>El Gato Negro</title>',
            '  </head>',
            '  <body class="calibre">',
            '    <img src=index_split_000.html/>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'HIGH-XHTML-003',
      name: '30-high-xhtml-003',
      description: 'Chapter XHTML includes forbidden DOCTYPE/entity markup.',
      mutate(entries) {
        setText(
          entries,
          'index_split_001.html',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!DOCTYPE html [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>&xxe;</title>',
            '  </head>',
            '  <body class="calibre">',
            '    <p>Forbidden entity sample</p>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'HIGH-ENC-001',
      name: '31-high-enc-001',
      description: 'Chapter bytes and XML declaration disagree.',
      mutate(entries) {
        const latin1Text = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
          '  <head>',
          '    <title>El Gato Negro - SeÃ±or</title>',
          '  </head>',
          '  <body class="calibre">',
          '    <p>NiÃ±o, corazÃ³n, razÃ³n.</p>',
          '  </body>',
          '</html>',
          '',
        ].join('\n');
        setBinary(entries, 'index_split_001.html', Buffer.from(latin1Text, 'latin1'));
      },
    },
    {
      id: 'HIGH-ENC-002',
      name: '32-high-enc-002',
      description: 'Chapter contains invalid XML control characters.',
      mutate(entries) {
        setText(
          entries,
          'index_split_001.html',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>El Gato Negro\u0001</title>',
            '  </head>',
            '  <body class="calibre">',
            '    <p>Invalid control character sample</p>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        );
      },
    },
    {
      id: 'HIGH-FALLBACK-001',
      name: '33-high-fallback-001',
      description: 'Scripted/foreign resource has no fallback.',
      mutate(entries) {
        setText(
          entries,
          'interactive.xhtml',
          [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">',
            '  <head>',
            '    <title>Interactive sample</title>',
            '    <script>console.log("interactive sample");</script>',
            '  </head>',
            '  <body class="calibre">',
            '    <p>Interactive sample with no fallback.</p>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        );
        replaceText(entries, 'content.opf', (text) => {
          const withManifest = text.replace(
            '</manifest>',
            '    <item href="interactive.xhtml" id="interactive" media-type="application/xhtml+xml" properties="scripted"/>\n  </manifest>',
          );
          return withManifest.replace('idref="id11"', 'idref="interactive"');
        });
      },
    },
  ];

  return samples.map((sample, index) => ({
    ...sample,
    index: index + 1,
  }));
}

async function main() {
  const safeOutputDir = ensureSafeOutputDir(outputDir);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source EPUB not found: ${sourcePath}`);
  }

  cleanOutputDir(safeOutputDir);
  const { sourceBuffer, entries: baseEntries, order: baseOrder } = await loadSource(sourcePath);
  const baseOpfText = getText(baseEntries, 'content.opf') || '';
  const samples = buildSamples(baseOpfText);
  const manifest = [];

  for (const sample of samples) {
    const destinationPath = path.join(safeOutputDir, `${sample.name}.epub`);
    if (sample.build) {
      await sample.build(sourceBuffer, destinationPath);
      manifest.push({
        name: sample.name,
        description: sample.description,
        file: destinationPath,
      });
      continue;
    }

    const entries = cloneEntries(baseEntries);
    if (sample.mutate) {
      sample.mutate(entries);
    }

    const order = sample.order ? sample.order(baseOrder.slice(), entries) : buildOrder(baseOrder, entries);
    await writeZip(entries, order, destinationPath);
    manifest.push({
      name: sample.name,
      description: sample.description,
      file: destinationPath,
    });
  }

  const readmePath = path.join(safeOutputDir, 'README.md');
  const samplesJsonPath = path.join(safeOutputDir, 'samples.json');
  writeReadme(readmePath, sourcePath, samples);
  fs.writeFileSync(samplesJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Generated ${samples.length} samples in ${safeOutputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
