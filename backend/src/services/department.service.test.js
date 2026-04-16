import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeDepartment,
  parseDepartmentFromGeminiText,
  classifyDepartment,
} from './department.service.js';

describe('normalizeDepartment', () => {
  it('maps synonyms to dental and skin', () => {
    assert.strictEqual(normalizeDepartment('DENTAL'), 'dental');
    assert.strictEqual(normalizeDepartment('tooth'), 'dental');
    assert.strictEqual(normalizeDepartment('dermatology'), 'skin');
  });

  it('defaults unknown labels to general', () => {
    assert.strictEqual(normalizeDepartment('random'), 'general');
    assert.strictEqual(normalizeDepartment(''), 'general');
  });
});

describe('parseDepartmentFromGeminiText', () => {
  it('parses noisy Gemini output', () => {
    assert.deepStrictEqual(parseDepartmentFromGeminiText('dental'), {
      department: 'dental',
      needsClarification: false,
    });
    assert.deepStrictEqual(parseDepartmentFromGeminiText('  SKIN '), {
      department: 'skin',
      needsClarification: false,
    });
    assert.deepStrictEqual(parseDepartmentFromGeminiText('general.'), {
      department: 'general',
      needsClarification: false,
    });
  });

  it('handles embedded words', () => {
    assert.deepStrictEqual(parseDepartmentFromGeminiText('I think dental is best'), {
      department: 'dental',
      needsClarification: false,
    });
  });

  it('uses normalizeDepartment when no keyword match', () => {
    assert.deepStrictEqual(parseDepartmentFromGeminiText('teeth'), {
      department: 'dental',
      needsClarification: false,
    });
  });

  it('empty string yields general', () => {
    assert.deepStrictEqual(parseDepartmentFromGeminiText(''), {
      department: 'general',
      needsClarification: false,
    });
  });
});

describe('classifyDepartment (no network)', () => {
  it('short symptoms request clarification without calling external APIs', async () => {
    const r = await classifyDepartment('ab');
    assert.deepStrictEqual(r, { department: 'general', needsClarification: true });
  });

  it('empty symptoms behave like short input', async () => {
    const r = await classifyDepartment('  ');
    assert.deepStrictEqual(r, { department: 'general', needsClarification: true });
  });

  it('uses keyword routing for tooth pain, skin rash, fever without Gemini', async () => {
    assert.deepStrictEqual(await classifyDepartment('tooth pain'), {
      department: 'dental',
      needsClarification: false,
    });
    assert.deepStrictEqual(await classifyDepartment('skin rash'), {
      department: 'skin',
      needsClarification: false,
    });
    assert.deepStrictEqual(await classifyDepartment('fever'), {
      department: 'general',
      needsClarification: false,
    });
  });
});
