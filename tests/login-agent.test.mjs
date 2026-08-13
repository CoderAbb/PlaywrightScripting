import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioSpec } from '../login-agent.mjs';

test('buildScenarioSpec includes happy path and edge cases', () => {
  const spec = buildScenarioSpec({
    url: 'https://example.com',
    selectors: {
      email: '[data-test="email"]',
      password: '[data-test="password"]',
      submit: '[data-test="login-submit"]'
    },
    scenarios: [
      { name: 'valid credentials', email: 'user@example.com', password: 'password123' },
      { name: 'empty username', email: '', password: 'password123' },
      { name: 'empty password', email: 'user@example.com', password: '' }
    ]
  });

  assert.match(spec, /test\('valid credentials'/);
  assert.match(spec, /test\('empty username'/);
  assert.match(spec, /test\('empty password'/);
  assert.match(spec, /async \(\{ page \}\) =>/);
});
