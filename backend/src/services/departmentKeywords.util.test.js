import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyDepartmentFromKeywords } from './departmentKeywords.util.js';

describe('classifyDepartmentFromKeywords', () => {
  it('routes tooth pain to dental', () => {
    assert.deepStrictEqual(classifyDepartmentFromKeywords('tooth pain'), {
      department: 'dental',
      matched: true,
    });
  });

  it('routes skin rash to skin', () => {
    assert.deepStrictEqual(classifyDepartmentFromKeywords('skin rash'), {
      department: 'skin',
      matched: true,
    });
  });

  it('routes fever to general', () => {
    assert.deepStrictEqual(classifyDepartmentFromKeywords('fever'), {
      department: 'general',
      matched: true,
    });
  });

  it('returns unmatched for ambiguous text so Gemini can decide', () => {
    const r = classifyDepartmentFromKeywords('something vague here');
    assert.strictEqual(r.matched, false);
  });

  it('does not label chest pain as routine general; urgent path handles it elsewhere', () => {
    const r = classifyDepartmentFromKeywords('I have chest pain');
    assert.strictEqual(r.matched, false);
  });
});
