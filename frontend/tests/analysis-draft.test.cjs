const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  canSubmitAnalysisDraft,
  resetAnalysisDraft,
} = require('../src/utils/analysis-draft.ts');
const {
  isValidUrl,
  normalizeUrl,
} = require('../src/utils/url-validation.ts');

const selectedImage = {
  uri: 'file:///selected-image.jpg',
  fileName: 'selected-image.jpg',
  mimeType: 'image/jpeg',
  width: 1200,
  height: 800,
};

test('normalizeUrl removes leading and trailing whitespace', () => {
  assert.equal(normalizeUrl('  https://example.com/item  \n'), 'https://example.com/item');
});

test('isValidUrl allows empty values and valid HTTP(S) URLs', () => {
  assert.equal(isValidUrl(''), true);
  assert.equal(isValidUrl('   '), true);
  assert.equal(isValidUrl('http://example.com/item'), true);
  assert.equal(isValidUrl('https://example.com/item?id=1'), true);
});

test('isValidUrl rejects unsupported or malformed URLs', () => {
  assert.equal(isValidUrl('example.com/item'), false);
  assert.equal(isValidUrl('ftp://example.com/item'), false);
  assert.equal(isValidUrl('https://'), false);
  assert.equal(isValidUrl('not a url'), false);
});

test('canSubmitAnalysisDraft accepts URL only', () => {
  assert.equal(
    canSubmitAnalysisDraft({ url: ' https://example.com/item ', image: null }),
    true,
  );
});

test('canSubmitAnalysisDraft accepts image only', () => {
  assert.equal(
    canSubmitAnalysisDraft({ url: '', image: selectedImage }),
    true,
  );
});

test('canSubmitAnalysisDraft accepts URL and image together', () => {
  assert.equal(
    canSubmitAnalysisDraft({
      url: 'https://example.com/item',
      image: selectedImage,
    }),
    true,
  );
});

test('canSubmitAnalysisDraft rejects empty, invalid, and submitting drafts', () => {
  assert.equal(canSubmitAnalysisDraft({ url: '', image: null }), false);
  assert.equal(
    canSubmitAnalysisDraft({ url: 'invalid', image: selectedImage }),
    false,
  );
  assert.equal(
    canSubmitAnalysisDraft(
      { url: 'https://example.com/item', image: null },
      true,
    ),
    false,
  );
});

test('resetAnalysisDraft returns a fresh empty draft', () => {
  const first = resetAnalysisDraft();
  const second = resetAnalysisDraft();

  assert.deepEqual(first, { url: '', image: null });
  assert.notEqual(first, second);
});
