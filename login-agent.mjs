#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';

function printUsage() {
  console.log('Usage:\n  node ./login-agent.mjs --url <url> --username <user> --password <password> [--flow <flow.json>] [--out <spec.ts>] [--edge] [--scenarios <scenarios.json>] [--run]');
}

function parseArgs(argv) {
  const args = { url: '', username: '', password: '', flowPath: undefined, outPath: undefined, edge: false, scenarioPath: undefined, run: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--url':
        args.url = argv[i + 1] ?? '';
        i += 1;
        break;
      case '--username':
        args.username = argv[i + 1] ?? '';
        i += 1;
        break;
      case '--password':
        args.password = argv[i + 1] ?? '';
        i += 1;
        break;
      case '--flow':
        args.flowPath = argv[i + 1];
        i += 1;
        break;
      case '--out':
        args.outPath = argv[i + 1];
        i += 1;
        break;
      case '--edge':
        args.edge = true;
        break;
      case '--scenarios':
        args.scenarioPath = argv[i + 1];
        i += 1;
        break;
      case '--run':
        args.run = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          throw new Error(`Unexpected argument: ${arg}`);
        }
    }
  }

  if (!args.url || !args.username || !args.password) {
    throw new Error('Missing required arguments. Provide --url, --username, and --password.');
  }

  return args;
}

async function readFlowSteps(flowPath) {
  if (!flowPath) {
    return [];
  }

  const resolvedPath = path.resolve(process.cwd(), flowPath);
  const content = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(content);
}

async function readScenarios(scenarioPath) {
  if (!scenarioPath) {
    return [];
  }

  const resolvedPath = path.resolve(process.cwd(), scenarioPath);
  const content = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(content);
}

function getDefaultScenarios() {
  return [
    { name: 'valid credentials', email: 'user@example.com', password: 'password123' },
    { name: 'empty username', email: '', password: 'password123' },
    { name: 'empty password', email: 'user@example.com', password: '' },
    { name: 'whitespace username', email: '   ', password: 'password123' },
  ];
}

function buildScenarioSpec({ url, selectors, scenarios }) {
  const lines = [];
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');

  for (const scenario of scenarios) {
    lines.push(`test('${escapeForString(scenario.name)}', async ({ page }) => {`);
    lines.push(`  await page.goto('${escapeForString(url)}');`);
    lines.push(`  await page.locator('${escapeForString(selectors.email)}').fill('${escapeForString(scenario.email ?? '')}');`);
    lines.push(`  await page.locator('${escapeForString(selectors.password)}').fill('${escapeForString(scenario.password ?? '')}');`);
    lines.push(`  await expect(page.locator('${escapeForString(selectors.email)}')).toBeVisible();`);
    lines.push(`  await expect(page.locator('${escapeForString(selectors.password)}')).toBeVisible();`);
    lines.push(`  await page.locator('${escapeForString(selectors.submit)}').click();`);
    lines.push(`  await expect(page.locator('${escapeForString(selectors.submit)}')).toBeVisible();`);
    lines.push('});');
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function findVisibleLocator(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

async function findLoginEntry(page) {
  const candidates = [
    'a[href*="login" i]',
    'button:has-text("Sign in")',
    'button:has-text("Login")',
    'button:has-text("Log in")',
    'a:has-text("Sign in")',
    'a:has-text("Login")',
    'a:has-text("Log in")',
  ];

  for (const selector of candidates) {
    const locator = await findVisibleLocator(page.locator(selector));
    if (locator) {
      return locator;
    }
  }

  return null;
}

async function findEmailField(page) {
  const candidates = [
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[placeholder*="username" i]',
    'input[placeholder*="login" i]',
    'input[type="text"]',
    'input',
  ];

  for (const selector of candidates) {
    const locator = await findVisibleLocator(page.locator(selector));
    if (locator) {
      return locator;
    }
  }

  return null;
}

async function findPasswordField(page) {
  return findVisibleLocator(page.locator('input[type="password"]'));
}

async function findSubmitButton(page) {
  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'button:has-text("Submit")',
    'button',
  ];

  for (const selector of candidates) {
    const locator = await findVisibleLocator(page.locator(selector));
    if (locator) {
      return locator;
    }
  }

  return null;
}

async function buildSelector(locator) {
  const tagName = await locator.evaluate((element) => element.tagName.toLowerCase());
  const attrs = await locator.evaluate((element) => {
    const result = {};
    const attrsToRead = ['data-testid', 'data-test', 'name', 'id', 'placeholder', 'aria-label'];
    for (const attr of attrsToRead) {
      const value = element.getAttribute(attr);
      if (value) {
        result[attr] = value;
      }
    }
    const type = element.getAttribute('type');
    if (type) {
      result.type = type;
    }
    return result;
  });

  if (attrs['data-testid']) {
    return `[data-testid="${attrs['data-testid']}"]`;
  }
  if (attrs['data-test']) {
    return `[data-test="${attrs['data-test']}"]`;
  }
  if (attrs.type && tagName === 'input') {
    return `input[type="${attrs.type}"]`;
  }
  if (attrs.name) {
    return `${tagName}[name="${attrs.name}"]`;
  }
  if (attrs.id) {
    return `${tagName}#${attrs.id}`;
  }
  if (attrs['aria-label']) {
    return `${tagName}[aria-label="${attrs['aria-label']}"]`;
  }
  if (attrs.placeholder) {
    return `${tagName}[placeholder="${attrs.placeholder}"]`;
  }
  return tagName;
}

function escapeForString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildLocatorExpression(step) {
  if (step.testId) {
    return `page.locator('[data-testid="${escapeForString(step.testId)}"], [data-test="${escapeForString(step.testId)}"]')`;
  }

  if (step.selector) {
    return `page.locator('${escapeForString(step.selector)}')`;
  }

  if (step.role && step.text) {
    return `page.getByRole('${escapeForString(step.role)}', { name: '${escapeForString(step.text)}' })`;
  }

  if (step.text) {
    return `page.getByText('${escapeForString(step.text)}', { exact: true })`;
  }

  return 'page.locator("body")';
}

function buildGeneratedSpec(url, loginLines, flowLines) {
  const lines = [];
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');
  lines.push("test('generated login flow', async ({ page }) => {");
  lines.push(`  await page.goto('${escapeForString(url)}');`);
  lines.push(...loginLines);
  lines.push(...flowLines);
  lines.push('});');
  return `${lines.join('\n')}\n`;
}

async function executeFlowStep(page, step, flowLines) {
  switch (step.action) {
    case 'goto': {
      await page.goto(step.url ?? '', { waitUntil: 'domcontentloaded' });
      flowLines.push(`  await page.goto('${escapeForString(step.url ?? '')}');`);
      break;
    }
    case 'click': {
      const locator = await resolveLocator(page, step);
      await locator.click();
      flowLines.push(`  await ${buildLocatorExpression(step)}.click();`);
      break;
    }
    case 'fill': {
      const locator = await resolveLocator(page, step);
      await locator.fill(step.value ?? '');
      flowLines.push(`  await ${buildLocatorExpression(step)}.fill('${escapeForString(step.value ?? '')}');`);
      break;
    }
    case 'assertText': {
      const locator = await resolveLocator(page, step);
      await expect(locator).toBeVisible();
      flowLines.push(`  await expect(${buildLocatorExpression(step)}).toBeVisible();`);
      break;
    }
    case 'waitForText': {
      const locator = await resolveLocator(page, step);
      await locator.waitFor({ state: 'visible' });
      flowLines.push(`  await ${buildLocatorExpression(step)}.waitFor({ state: 'visible' });`);
      break;
    }
    default:
      break;
  }
}

async function resolveLocator(page, step) {
  const byRoleText = step.role && step.text
    ? page.getByRole(step.role, { name: step.text })
    : null;

  if (step.testId) {
    return page.locator(`[data-testid="${step.testId}"], [data-test="${step.testId}"]`);
  }

  if (step.selector) {
    return page.locator(step.selector);
  }

  if (byRoleText) {
    return byRoleText;
  }

  if (step.text) {
    return page.getByText(step.text, { exact: true });
  }

  return page.locator('body');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const flowSteps = await readFlowSteps(args.flowPath);

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();

  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const loginEntry = await findLoginEntry(page);
    if (loginEntry) {
      await loginEntry.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    const emailField = await findEmailField(page);
    const passwordField = await findPasswordField(page);
    const submitButton = await findSubmitButton(page);

    if (!emailField || !passwordField || !submitButton) {
      throw new Error('Could not identify a standard login form on the page.');
    }

    const emailSelector = await buildSelector(emailField);
    const passwordSelector = await buildSelector(passwordField);
    const submitSelector = await buildSelector(submitButton);

    const outPath = args.outPath ? path.resolve(process.cwd(), args.outPath) : path.resolve(process.cwd(), 'generated.spec.ts');

    if (args.edge || args.scenarioPath) {
      const scenarios = args.scenarioPath ? await readScenarios(args.scenarioPath) : getDefaultScenarios();
      const specSource = buildScenarioSpec({
        url: args.url,
        selectors: {
          email: emailSelector,
          password: passwordSelector,
          submit: submitSelector,
        },
        scenarios,
      });
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, specSource, 'utf8');
      console.log(`Generated edge-case Playwright spec at ${outPath}`);

      if (args.run) {
        await runCommand('npx', ['playwright', 'test', outPath, '--project=chromium', '--workers=1']);
      }
      return;
    }

    const loginLines = [];
    const flowLines = [];
    loginLines.push(`  await page.locator('${escapeForString(emailSelector)}').fill('${escapeForString(args.username)}');`);
    loginLines.push(`  await page.locator('${escapeForString(passwordSelector)}').fill('${escapeForString(args.password)}');`);
    loginLines.push(`  await page.locator('${escapeForString(submitSelector)}').click();`);

    await emailField.fill(args.username);
    await passwordField.fill(args.password);
    await submitButton.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    for (const step of flowSteps) {
      await executeFlowStep(page, step, flowLines);
    }

    const specSource = buildGeneratedSpec(args.url, loginLines, flowLines);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, specSource, 'utf8');

    console.log(`Generated Playwright spec at ${outPath}`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { buildScenarioSpec };
