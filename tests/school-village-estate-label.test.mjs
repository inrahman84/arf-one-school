import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Daftar Sekolah add/edit uses Desa/Estate', () => {
  const view = read('src/features/schools/SchoolsListView.tsx');
  assert.match(view, />Desa\/Estate<\/label>/);
  assert.match(view, /value=\{formData\.village\}/);
  assert.match(view, /village: formData\.village\.trim\(\)/);
});

test('Daftar Sekolah filters and searches by Desa/Estate', () => {
  const view = read('src/features/schools/SchoolsListView.tsx');
  assert.match(view, /aria-label="Filter Desa\/Estate"/);
  assert.match(view, /Semua Desa\/Estate/);
  assert.match(view, /Belum ada data Desa\/Estate/);
  assert.match(view, /desa\/estate\.\.\./);
  assert.doesNotMatch(view, /Desa\s*\/\s*Kelurahan|desa\/kelurahan/);
});

test('Field name village remains compatible with existing Supabase records', () => {
  const types = read('src/types/index.ts');
  assert.match(types, /village\?: string; \/\/ Desa\/Estate/);
  assert.match(read('src/features/schools/SchoolsListView.tsx'), /\(s\.village \|\| ''\)\.trim\(\)/);
});
