// @ts-check

const fs = require('fs');
const path = require('path');

const { getAppSpec, getSupportedAppIds } = require('./playstore-specs.cjs');

async function runPromptCli(appId, argv = process.argv.slice(2)) {
  const app = getAppSpec(appId ?? resolveAppId(argv));
  const locales = resolveLocales(argv, app.supportedLocales, app.id);
  await generatePrompts(app, locales);
}

async function generatePrompts(app, locales) {
  const rootDir = path.resolve(__dirname, '../../');
  const fichasDir = path.join(rootDir, 'docs/fichas', app.id);
  const promptsRootDir = path.join(fichasDir, 'prompts');

  for (const locale of locales) {
    const sourcePath = path.join(fichasDir, `${locale}.md`);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source ficha: ${sourcePath}`);
    }

    const source = fs.readFileSync(sourcePath, 'utf8');
    fs.mkdirSync(promptsRootDir, { recursive: true });
    const outputPath = path.join(promptsRootDir, `${locale}.md`);
    const prompts = [];

    for (const section of app.promptSections) {
      const body = extractSection(source, section.heading);
      prompts.push(
        buildPrompt({
          app,
          locale,
          sourcePath,
          section,
          body,
        }),
      );
    }

    writeIfChanged(outputPath, prompts.join('\n'));
    console.log(`written ${path.relative(rootDir, outputPath)}`);
  }
}

function buildPrompt({ app, locale, sourcePath, section, body }) {
  const { handling, cleanedBody } = extractRawScreenshotHandling(body);
  const lines = [];
  const sourceScreenshot = section.screenshot && section.rawFile
    ? `tools/playstore/raw/${app.id}/${locale}/${section.rawFile}`
    : null;

  lines.push(`# ${section.heading}`);
  lines.push('');
  lines.push(
    `Source ficha: \`${path
      .relative(path.resolve(__dirname, '../../'), sourcePath)
      .replace(/\\/g, '/')}\``,
  );
  if (sourceScreenshot) {
    lines.push(`Source screenshot: \`${sourceScreenshot}\``);
  } else {
    lines.push('Source screenshot: none');
  }
  lines.push('');
  lines.push('Generate image.');
  lines.push('');

  if (!section.screenshot) {
    if (section.heading === 'Feature Graphic') {
      lines.push(
        'Create a standalone feature graphic from this brief. Do not use a screenshot input.',
      );
      lines.push('');
    } else if (section.heading === 'Screenshot 1') {
      lines.push(
        'Create a standalone screenshot-style composition from this brief. Do not use a screenshot input.',
      );
      lines.push('');
    }
  }

  if (section.screenshot && handling) {
    lines.push(buildScreenshotHandlingIntro(handling));
    lines.push('');
    if (handling.strictRule) {
      lines.push(handling.strictRule);
      lines.push('');
    }
  }

  lines.push('Brief');
  lines.push('');
  lines.push(cleanedBody.trimEnd());

  return `${lines.join('\n').trimEnd()}\n`;
}

function extractSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    throw new Error(`Section not found: ${heading}`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end).join('\n').trim();
}

function extractRawScreenshotHandling(body) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === 'raw screenshot handling:',
  );
  if (start === -1) {
    return { handling: null, cleanedBody: body };
  }

  const instructions = [];
  let end = start + 1;
  while (end < lines.length) {
    const trimmed = lines[end].trim();
    if (!trimmed) {
      end += 1;
      continue;
    }
    if (!/^(\*|-|\d+\.)\s+/.test(trimmed)) {
      break;
    }
    instructions.push(trimmed);
    end += 1;
  }

  const cleanedLines = [...lines.slice(0, start), ...lines.slice(end)];
  const cleanedBody = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const onlyReplace = instructions.find((line) => /^Only replace /i.test(line)) ?? '';
  const useRegionBook =
    instructions.find((line) =>
      /^Use a public-domain book popular in the region\.?$/i.test(line),
    ) ?? '';
  const noRestyle =
    instructions.find((line) => /^Do not add, remove, invent, or restyle/i.test(line)) ?? '';
  const keepComposition =
    instructions.find((line) => /^Keep the raw screenshot composition intact\.?$/i.test(line)) ??
    '';

  return {
    handling: {
      instructions,
      onlyReplace,
      useRegionBook,
      noRestyle,
      keepComposition,
      strictRule:
        keepComposition || noRestyle
          ? 'Strict rule: keep the raw screenshot composition intact. Only replace the explicitly named content. Do not add, remove, invent, or restyle any other element.'
          : '',
    },
    cleanedBody,
  };
}

function buildScreenshotHandlingIntro(handling) {
  const parts = ['Use my screenshot in your composition.'];
  if (handling.instructions.length > 0) {
    parts.push('Raw replacement instructions:');
    parts.push(...handling.instructions);
  }
  if (handling.onlyReplace) {
    parts.push(handling.onlyReplace);
  }
  if (handling.useRegionBook) {
    parts.push(handling.useRegionBook);
  }
  if (handling.noRestyle && !handling.strictRule) {
    parts.push(handling.noRestyle);
  }
  return parts.join('\n');
}

function writeIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (current === content) {
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function resolveLocales(argv, supportedLocales, appId) {
  const rawArg = argv.find((value) => value.startsWith('--locales='));
  const rawLocaleArg = argv.find((value) => value.startsWith('--locale='));
  const raw = rawArg
    ? rawArg.slice('--locales='.length)
    : rawLocaleArg
      ? rawLocaleArg.slice('--locale='.length)
      : '';

  if (!raw) {
    return [...supportedLocales];
  }

  const requested = raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return [...supportedLocales];
  }

  const rootDir = path.resolve(__dirname, '../../');
  const valid = requested.filter((locale) =>
    /^[a-z]{2}-[A-Z]{2}$/.test(locale) &&
    fs.existsSync(path.join(rootDir, 'docs/fichas', appId, `${locale}.md`)),
  );

  if (valid.length === 0) {
    throw new Error(
      `No valid locales in "${raw}". Use locale files from docs/fichas/${appId}.`,
    );
  }

  return [...new Set(valid)];
}

function resolveAppId(argv) {
  const rawArg = argv.find((arg) => arg.startsWith('--app='));
  if (!rawArg) {
    return getSupportedAppIds()[0];
  }

  return rawArg.slice('--app='.length).trim();
}

module.exports = {
  generatePrompts,
  runPromptCli,
};

if (require.main === module) {
  runPromptCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
