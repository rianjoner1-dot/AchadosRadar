import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.resolve(projectRoot, '..', 'robo-afiliados-autonomo');
const profilePath = path.join(projectRoot, 'data', 'chrome-profile');

const initialUrls = [
  'https://affiliate.shopee.com.br/offer/product_offer',
  'https://shopee.com.br/buyer/login',
  'https://associados.amazon.com.br'
];

async function findChromium() {
  const custom = process.env.ACHADOS_CHROME_EXECUTABLE?.trim();
  if (custom && existsSync(custom)) return custom;

  // 1. Playwright Chromium (independente, não conflita com o Chrome pessoal aberto)
  const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidate = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((a, b) => Number(b.name.slice(9)) - Number(a.name.slice(9)))
    .map((entry) => path.join(root, entry.name, 'chrome-win64', 'chrome.exe'))
    .find(existsSync);
  if (candidate) return candidate;

  // 2. Fallback: Google Chrome
  const chromeStandard = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].find(existsSync);
  return chromeStandard;
}

async function main() {
  await mkdir(profilePath, { recursive: true });
  const browserPath = await findChromium();

  if (!browserPath) {
    console.error('❌ Executável do Chrome ou Chromium não encontrado.');
    process.exit(1);
  }

  console.log(`🌐 Abrindo navegador do robô com janela visível...`);
  console.log(`📁 Perfil persistente: ${profilePath}`);
  console.log(`🧩 Extensão carregada: ${extensionPath}`);

  const browser = spawn(browserPath, [
    '--new-window',
    '--window-position=80,60',
    '--window-size=1280,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--lang=pt-BR',
    `--user-data-dir=${profilePath}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    ...initialUrls
  ], { detached: true, stdio: 'ignore' });

  browser.unref();

  console.log('✅ Janela do robô aberta na sua tela!');
  console.log('👉 Faça login na Shopee (e na Amazon se desejar) nessa janela.');
  console.log('👉 Após fazer login, você pode fechar o navegador ou deixá-lo aberto.');
  console.log('👉 Todas as sessões e cookies ficarão salvos no perfil do robô permanentemente.');
}

main().catch(console.error);
