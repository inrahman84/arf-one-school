import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sanitizeDirectNumber, parseDirectNumber, formatDirectNumber
} from '../src/lib/directNumberEntry.ts';

test('Direct numeric typing accepts digits without browser spinner or thousands separators', () => {
  assert.equal(sanitizeDirectNumber('250000'), '250000');
  assert.equal(sanitizeDirectNumber('Rp 1.250.000'), '1250000');
  assert.equal(sanitizeDirectNumber('000056'), '000056');
  assert.equal(sanitizeDirectNumber('9'.repeat(24)), '9'.repeat(15));
  assert.equal(parseDirectNumber('1250000'), 1250000);
  assert.equal(parseDirectNumber(''), 0);
  assert.equal(parseDirectNumber('999999999999999999'), null);
});

test('Area accepts decimal comma/dot but capacity and unit price stay integers', () => {
  assert.equal(sanitizeDirectNumber('12,75', true), '12.75');
  assert.equal(sanitizeDirectNumber('12.75', true), '12.75');
  assert.equal(sanitizeDirectNumber('12.5.6', true), '12.56');
  assert.equal(parseDirectNumber('12.75'), 12.75);
  assert.equal(sanitizeDirectNumber('Rp 125.000', false), '125000');
  assert.equal(formatDirectNumber(125000, true), '125.000');
  assert.equal(formatDirectNumber(0, true), '');
});

test('Form fields use reusable direct number entry (including acquisition unit price)', () => {
  const paths = [
    '../src/features/assets/AssetsView.tsx',
    '../src/features/facilities/FacilitiesView.tsx',
    '../src/features/hr/HRView.tsx',
    '../src/features/enrollment/EnrollmentView.tsx',
    '../src/features/schools/SchoolsListView.tsx'
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /DirectNumberInput/, 'missing direct number input in ' + path);
    assert.doesNotMatch(source, /type="number"/, 'numeric spinner remains in ' + path);
  }
  const assets = readFileSync(new URL(paths[0], import.meta.url), 'utf8');
  assert.match(assets, /<DirectNumberInput[\s\S]{0,100}currency[\s\S]{0,150}acquisition_unit_value/);
  const facilities = readFileSync(new URL(paths[1], import.meta.url), 'utf8');
  assert.match(facilities, /<DirectNumberInput[\s\S]{0,100}allowDecimal[\s\S]{0,150}facility_area_m2/);
  assert.match(facilities, /estimated_repair_cost/);
});

test('Shared number field is spinner-free and selects existing content on focus', () => {
  const source = readFileSync(new URL('../src/components/ui/DirectNumberInput.tsx', import.meta.url), 'utf8');
  assert.match(source, /type="text"/);
  assert.match(source, /inputMode=\{allowDecimal \? 'decimal' : 'numeric'\}/);
  assert.match(source, /event.currentTarget.select\(\)/);
  assert.match(source, /onValueChange\(parsed\)/);
  assert.doesNotMatch(source, /type="number"/);
});
