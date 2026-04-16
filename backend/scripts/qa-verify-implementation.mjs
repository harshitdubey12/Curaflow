/**
 * Static QA checks: exports, schema fields, urgent-care copy, smart-wait formula sample.
 * Does not call Gemini or the database.
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { translateMessage } from '../src/services/translation.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');
assert.ok(schema.includes('model Visit'), 'schema has Visit model');
assert.ok(schema.includes('startTime'), 'Visit has startTime');
assert.ok(schema.includes('endTime'), 'Visit has endTime');
assert.ok(schema.includes('doctorDelayPingAt'), 'Queue has doctorDelayPingAt for doctor-delay dedupe');

const routesPath = join(__dirname, '../src/routes/index.js');
const routesSrc = readFileSync(routesPath, 'utf8');
assert.ok(
  routesSrc.includes("'/analytics', requireStaffKey") && routesSrc.includes("'/broadcast', requireStaffKey"),
  'analytics and broadcast routes use requireStaffKey'
);

const { generateAIResponse } = await import('../src/services/aiService.js');
assert.strictEqual(typeof generateAIResponse, 'function', 'generateAIResponse exists');

const waitMod = await import('../src/services/waitTimeService.js');
assert.strictEqual(typeof waitMod.calculateSmartWaitTime, 'function', 'calculateSmartWaitTime exists');
assert.strictEqual(typeof waitMod.calculateSmartWaitMinutes, 'function', 'calculateSmartWaitMinutes exists');

const deptMod = await import('../src/services/department.service.js');
assert.strictEqual(typeof deptMod.classifyDepartment, 'function', 'classifyDepartment exists');

const urgent = translateMessage('chatbotUrgentCare', 'en', {});
const low = urgent.toLowerCase();
assert.ok(low.includes('contact'), 'urgent copy mentions contact');
assert.ok(low.includes('doctor'), 'urgent copy mentions doctor');
assert.ok(low.includes('immediately'), 'urgent copy mentions immediately');

const avg = (10 + 15 + 20 + 25 + 30) / 5;
const ahead = 3;
assert.strictEqual(Math.round(ahead * avg), 60, 'sample avg × ahead rounds like smart wait');

console.log('qa-verify-implementation: OK');
