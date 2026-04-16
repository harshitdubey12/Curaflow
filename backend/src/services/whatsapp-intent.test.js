import test from 'node:test';
import assert from 'node:assert/strict';
import { detectWhatsAppIntent } from './whatsapp-intent.js';

test('join intent: natural token asks route to queue flow', () => {
  assert.equal(detectWhatsAppIntent('just give me the token no with name harshit'), 'join');
  assert.equal(detectWhatsAppIntent('I need a token'), 'join');
  assert.equal(detectWhatsAppIntent('JOIN'), 'join');
});

test('assist intent: FAQ and greetings stay on assist path', () => {
  assert.equal(detectWhatsAppIntent('what are your hours?'), 'assist');
  assert.equal(detectWhatsAppIntent('hii'), 'assist');
});

test('status intent: wait and position queries', () => {
  assert.equal(detectWhatsAppIntent('what is my token'), 'status');
  assert.equal(detectWhatsAppIntent('how long is the wait'), 'status');
});
