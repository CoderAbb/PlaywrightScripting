#!/usr/bin/env ts-node
import { chromium, type Locator, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';

interface FlowStep {
  action: 'click' | 'fill' | 'goto' | 'assertText' | 'waitForText';
  text?: string;
  role?: string;
  testId?: string;
  selector?: string;
  value?: string;
  url?: string;
}

interface CliArgs {
  url: string;
  username: string;
  password: string;
  flowPath?: string;
  outPath?: string;
}

function printUsage() {
  console.log(`Usage:\n  npx ts-node login-agent.ts --url <url> --username <user> --password <password> [--flow <flow.json>] [--out <spec.ts>]`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    url: '',
    username: '',
    password: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--url':
        args.url = argv[i + 1] ?? '';
        break;
      case '--username':
        args.username = argv[i + 1] ?? '';
        break;
      case '--password':
        args.password = argv[i + 1] ?? '';
        break;
      case '--flow':
        args.flowPath = argv[i + 1];
        break;
      case '--out':
        args.outPath = argv[i + 1];
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

async function readFlowSteps(flowPath?: string): Promise<FlowStep[]> {
  if (!flowPath) {
    return [];
  }

  const resolvedPath = path.resolve(process.cwd(), flowPath);
  const content = await fs.readFile(resolvedPath, 'utf8');
  const parsed = JSON.parse(content) as FlowStep[];
  return parsed;
}

async function findVisibleLocator(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

async function findEmailField(page: Page): Promise<Locator | null> {
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
  ];

  for (const selector of candidates) {
    const locator = await findVisibleLocator(page.locator(selector));
    if (locator) {
      return locator;
    }
  }

  return null;
}

async function findPasswordField(page: Page): Promise<Locator | null> {
  return findVisibleLocator(page.locator('input[type="password"]'));
}

async function findSubmitButton(page: Page): Promise<Locator | null> {
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

function escapeForString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildLocatorExpression(step: FlowStep): string {
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

function buildGeneratedSpec(url: string, username: string, password: string, steps: FlowStep[], loginSteps: string[]): string {
  const lines: string[] = [];
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');
  lines.push("test('generated login flow', async ({ page }) => {");
  lines.push(`  await page.goto('${escapeForString(url)}');`);
  lines.push(...loginSteps);

  for (const step of steps) {
    switch (step.action) {
      case 'goto':
        lines.push(`  await page.goto('${escapeForString(step.url ?? '')}');`);
        break;
      case 'click': {
        const locator = buildLocatorExpression(step);
        lines.push(`  await ${locator}.click();`);
        break;
      }
      case 'fill': {
        const locator = buildLocatorExpression(step);
        lines.push(`  await ${locator}.fill('${escapeForString(step.value ?? '')}');`);
        break;
      }
      case 'assertText': {
        const locator = buildLocatorExpression(step);
        lines.push(`  await expect(${locator}).toBeVisible();`);
        break;
      }
      case 'waitForText': {
        const locator = buildLocatorExpression(step);
        lines.push(`  await ${locator}.waitFor({ state: 'visible' });`);
        break;
      }
    }
  }

  lines.push('});');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const flowSteps = await readFlowSteps(args.flowPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const loginSteps: string[] = [];

  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const emailField = await findEmailField(page);
    const passwordField = await findPasswordField(page);
    const submitButton = await findSubmitButton(page);

    if (!emailField || !passwordField || !submitButton) {
      throw new Error('Could not identify a standard login form on the page.');
    }

    loginSteps.push(`  await page.locator('${escapeForString(await emailField.evaluate((element) => element.getAttribute('data-test') ?? element.getAttribute('data-testid') ?? element.getAttribute('name') ?? element.getAttribute('id') ?? element.getAttribute('placeholder') ?? 'input')}').fill('${escapeForString(args.username)}');`);
    loginSteps.push(`  await page.locator('${escapeForString(await passwordField.evaluate((element) => element.getAttribute('data-test') ?? element.getAttribute('data-testid') ?? element.getAttribute('name') ?? element.getAttribute('id') ?? 'input')}').fill('${escapeForString(args.password)}');`);
    loginSteps.push(`  await page.locator('${escapeForString(await submitButton.evaluate((element) => element.getAttribute('data-test') ?? element.getAttribute('data-testid') ?? element.getAttribute('name') ?? element.getAttribute('id') ?? 'button')}').click();`);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const outPath = args.outPath ? path.resolve(process.cwd(), args.outPath) : path.resolve(process.cwd(), 'generated.spec.ts');
    const specSource = buildGeneratedSpec(args.url, args.username, args.password, flowSteps, loginSteps);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, specSource, 'utf8');

    console.log(`Generated Playwright spec at ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
