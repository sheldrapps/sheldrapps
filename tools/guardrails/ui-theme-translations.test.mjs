import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = 'packages/ui-theme/src/lib/translations/triple-button.translations.ts';
const source = fs.readFileSync(file, 'utf8');
const locales = [
  'en-US', 'es-MX', 'de-DE', 'fr-FR', 'hi-IN', 'it-IT', 'pt-BR',
  'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ru-RU', 'ar-SA',
];

test('ui-theme triple-button translations cover all 13 locales and keys', () => {
  for (const locale of locales) {
    const start = source.indexOf(`'${locale}':`);
    assert.notEqual(start, -1, `Missing locale: ${locale}`);
    const end = source.indexOf("\n  },", start);
    const block = source.slice(start, end === -1 ? source.length : end);

    for (const key of [
      'TITLE', 'BEST', 'OPTIMIZED', 'THUMBNAIL',
      'BOOKS_AND_CHAPTERS', 'BOOKS_ONLY', 'FULL_INDEX',
    ]) {
      assert.match(block, new RegExp(`\\b${key}:`), `${locale} is missing ${key}`);
    }

    assert.doesNotMatch(block, /Ã|Â|â|ð|�/, `${locale} contains mojibake`);
  }
});
