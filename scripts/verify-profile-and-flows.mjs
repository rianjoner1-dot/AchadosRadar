import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const baseUrl = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:4324';

// Check if dev server is up
const health = await fetch(new URL('/', baseUrl), { signal: AbortSignal.timeout(3000) }).catch(() => null);
if (!health?.ok) throw new Error(`Site is unavailable at ${baseUrl}. Ensure dev server is running on that port.`);

const chromeExecutable = resolveChromeExecutable();
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'chrome-profile-flows-'));
const testFilesDir = await mkdtemp(path.join(os.tmpdir(), 'chrome-avatar-fixtures-'));
const debuggingPort = 9222 + Math.floor(Math.random() * 500);

// Create local file fixtures for CDP file-input selection; this does not open the native picker.
const oversizedJpgPath = path.join(testFilesDir, 'foto-gigante.jpg');
await writeFile(oversizedJpgPath, Buffer.alloc(6 * 1024 * 1024)); // 6 MB
const invalidSvgPath = path.join(testFilesDir, 'avatar-malicioso.svg');
await writeFile(invalidSvgPath, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
const corruptPngPath = path.join(testFilesDir, 'foto-corrompida.png');
await writeFile(corruptPngPath, Buffer.from('not-a-valid-png'));

const validPngPath = path.join(testFilesDir, 'perfil-valido.png');
const replacementPngPath = path.join(testFilesDir, 'perfil-substituto.png');
const validPngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);
await writeFile(validPngPath, validPngBytes);
await writeFile(replacementPngPath, validPngBytes);

const chrome = spawn(chromeExecutable, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-extensions',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profilePath}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

let socket = null;
let messageId = 0;
const pending = new Map();

function onMessage(event) {
  try {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    }
  } catch (err) {
    console.error('WebSocket parse error:', err);
  }
}

async function command(method, params = {}) {
  const id = ++messageId;
  const message = JSON.stringify({ id, method, params });
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(message);
  });
}

async function evaluate(expression) {
  const response = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || 'Runtime.evaluate exception');
  }
  return response.result?.value;
}

async function waitForWsUrl() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch { /* wait for chrome startup */ }
    if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
    await delay(100);
  }
  throw new Error('Chrome DevTools failed to initialize.');
}

const results = {
  evidenceScope: 'Anonymous account UI and actual local file-input handlers only; no Supabase session, profile persistence, remote cart sync, avatar upload, or affiliate redirect is exercised.',
  profileForm: {},
  avatarCard: {},
  authenticatedProfile: { status: 'not-tested', reason: 'No Supabase development session is used by this isolated browser.' },
  authenticatedCart: { status: 'not-tested', reason: 'No Supabase session or remote cart synchronization is used by this isolated browser.' },
  outboundPurchases: { status: 'not-tested', reason: 'Calling /api/out records an affiliate click and is excluded from this local verifier.' },
  localUiAndAvatarChecksPassed: false
};

try {
  socket = new WebSocket(await waitForWsUrl());
  socket.addEventListener('message', onMessage);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  await command('Page.enable');
  await command('Runtime.enable');
  await command('DOM.enable');
  await command('Network.enable');

  // Block affiliate exits and metric writes in case the page or test changes later.
  await command('Network.setBlockedURLs', {
    urls: [
      '*/api/out/*',
      '*rest/v1/rpc/record_product_metric*',
      '*rest/v1/rpc/report_product_image_failure*'
    ]
  });

  // =========================================================================
  // 1. Test /conta: anonymous view, name field, and OTP options
  // =========================================================================
  await command('Page.navigate', { url: new URL('/conta', baseUrl).href });
  await delay(500);

  const anonConta = await evaluate(`(() => {
    const nameInput = document.querySelector('#newAccountName');
    const emailInput = document.querySelector('#emailInput');
    const form = document.querySelector('#requestOtpForm');
    const loginPanel = document.querySelector('#loginPanel');
    const profilePanel = document.querySelector('#profilePanel');
    return {
      loginPanelVisible: !loginPanel?.hidden,
      profilePanelHidden: Boolean(profilePanel?.hidden),
      hasNameInput: Boolean(nameInput),
      hasEmailInput: Boolean(emailInput),
      nameMaxLength: nameInput?.maxLength ?? 0,
      namePlaceholder: nameInput?.placeholder ?? ''
    };
  })()`);

  results.profileForm.anonymousView = anonConta;

  // =========================================================================
  // 2. Test Avatar Card: click, filename display, validation, replacement
  // =========================================================================
  const avatarCardCheck = await evaluate(`(() => {
    const card = document.querySelector('.avatar-upload-card');
    const fileInput = document.querySelector('#avatarFile');
    const fileNameSpan = document.querySelector('#avatarFileName');
    const preview = document.querySelector('#avatarPreview');
    const status = document.querySelector('#profileStatus');

    const hasCard = Boolean(card);
    const hasFileInput = Boolean(fileInput);
    const initialFileName = fileNameSpan?.textContent?.trim();
    const previewInitiallyHidden = Boolean(preview?.hidden);
    const labelForOrContains = card?.contains(fileInput) || card?.getAttribute('for') === fileInput?.id;

    return {
      hasCard,
      hasFileInput,
      labelForOrContains,
      initialFileName,
      previewInitiallyHidden
    };
  })()`);

  async function setFileInput(filePath) {
    const doc = await command('DOM.getDocument', { depth: -1 });
    const node = await command('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#avatarFile'
    });
    await command('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files: [filePath]
    });
    await evaluate(`(() => {
      const input = document.querySelector('#avatarFile');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await delay(150);
    return await evaluate(`(() => {
      const file = document.querySelector('#avatarFile').files?.[0];
      return file ? { name: file.name, type: file.type, size: file.size } : null;
    })()`);
  }

  // Use CDP to select a disallowed file directly, bypassing only the picker filter.
  const invalidMimeSelection = await setFileInput(invalidSvgPath);

  const invalidMimeTest = await evaluate(`(() => {
    const fileNameSpan = document.querySelector('#avatarFileName');
    const status = document.querySelector('#profileStatus');
    return {
      fileNameDisplayed: fileNameSpan.textContent,
      statusMessage: status.textContent,
      invalidRejected: fileNameSpan.textContent === 'avatar-malicioso.svg' && status.textContent.includes('JPEG, PNG ou WebP')
    };
  })()`);

  // Test oversized file feedback (> 5MB) via native CDP file selection
  const oversizedSelection = await setFileInput(oversizedJpgPath);

  const oversizedTest = await evaluate(`(() => {
    const fileNameSpan = document.querySelector('#avatarFileName');
    const status = document.querySelector('#profileStatus');
    return {
      fileNameDisplayed: fileNameSpan.textContent,
      statusMessage: status.textContent,
      oversizedRejected: fileNameSpan.textContent === 'foto-gigante.jpg' && status.textContent.includes('até 5 MB')
    };
  })()`);

  // Test that a valid MIME type cannot make a corrupt image appear valid.
  const corruptSelection = await setFileInput(corruptPngPath);
  const corruptImageTest = await evaluate(`(() => {
    const fileNameSpan = document.querySelector('#avatarFileName');
    const status = document.querySelector('#profileStatus');
    return {
      fileNameDisplayed: fileNameSpan.textContent,
      statusMessage: status.textContent,
      corruptImageRejected: status.textContent.includes('Não foi possível abrir essa imagem')
    };
  })()`);

  // Test actual local object-URL preview and replacement; do not simulate a saved upload.
  await setFileInput(validPngPath);
  await delay(150);

  const validAvatarPreview = await evaluate(`(() => {
    const fileNameSpan = document.querySelector('#avatarFileName');
    const preview = document.querySelector('#avatarPreview');
    const status = document.querySelector('#profileStatus');
    return {
      fileName: fileNameSpan.textContent,
      previewUrl: preview.src,
      previewIsLocal: preview.src.startsWith('blob:'),
      imageLoaded: preview.complete && preview.naturalWidth > 0 && preview.naturalHeight > 0,
      previewVisible: !preview.hidden,
      saveHintShown: status.textContent.includes('Salve as alterações')
    };
  })()`);
  await evaluate(`window.__firstAvatarPreviewUrl = ${JSON.stringify(validAvatarPreview.previewUrl)};`);

  await setFileInput(replacementPngPath);
  const replacementPreview = await evaluate(`(() => {
    const fileNameSpan = document.querySelector('#avatarFileName');
    const preview = document.querySelector('#avatarPreview');
    const status = document.querySelector('#profileStatus');
    return {
      fileName: fileNameSpan.textContent,
      previewUrl: preview.src,
      previewIsLocal: preview.src.startsWith('blob:'),
      imageLoaded: preview.complete && preview.naturalWidth > 0 && preview.naturalHeight > 0,
      previewVisible: !preview.hidden,
      saveHintShown: status.textContent.includes('Salve as alterações')
    };
  })()`);
  const oldPreviewWasRevoked = await evaluate(`(async () => {
    try {
      await fetch(window.__firstAvatarPreviewUrl);
      return false;
    } catch {
      return true;
    }
  })()`);

  const validAvatarTest = {
    ...validAvatarPreview,
    replacementFileName: replacementPreview.fileName,
    replacementChangedPreview: replacementPreview.previewIsLocal && replacementPreview.previewUrl !== validAvatarPreview.previewUrl,
    replacementImageLoaded: replacementPreview.imageLoaded,
    previousPreviewRevoked: oldPreviewWasRevoked,
    replacementPreviewVisible: replacementPreview.previewVisible,
    replacementSaveHintShown: replacementPreview.saveHintShown
  };

  results.avatarCard = {
    cardAssociation: avatarCardCheck,
    invalidMimeRejection: invalidMimeTest,
    invalidMimeSelection,
    oversizedRejection: oversizedTest,
    oversizedSelection,
    corruptImageRejection: corruptImageTest,
    corruptSelection,
    validSelectionAndReplacement: validAvatarTest
  };

  // This checker only reports the anonymous form and browser file-input behavior.
  const pForm = results.profileForm.anonymousView?.loginPanelVisible
    && results.profileForm.anonymousView?.hasNameInput
    && results.profileForm.anonymousView?.hasEmailInput;
  const pAvatar = results.avatarCard.cardAssociation?.labelForOrContains
    && results.avatarCard.invalidMimeRejection?.invalidRejected
    && results.avatarCard.oversizedRejection?.oversizedRejected
    && results.avatarCard.corruptImageRejection?.corruptImageRejected
    && results.avatarCard.validSelectionAndReplacement?.fileName === 'perfil-valido.png'
    && results.avatarCard.validSelectionAndReplacement?.previewIsLocal
    && results.avatarCard.validSelectionAndReplacement?.imageLoaded
    && results.avatarCard.validSelectionAndReplacement?.previewVisible
    && results.avatarCard.validSelectionAndReplacement?.saveHintShown
    && results.avatarCard.validSelectionAndReplacement?.replacementFileName === 'perfil-substituto.png'
    && results.avatarCard.validSelectionAndReplacement?.replacementChangedPreview
    && results.avatarCard.validSelectionAndReplacement?.previousPreviewRevoked
    && results.avatarCard.validSelectionAndReplacement?.replacementImageLoaded
    && results.avatarCard.validSelectionAndReplacement?.replacementPreviewVisible
    && results.avatarCard.validSelectionAndReplacement?.replacementSaveHintShown;
  results.localUiAndAvatarChecksPassed = Boolean(pForm && pAvatar);

  console.log(JSON.stringify(results, null, 2));

  if (!results.localUiAndAvatarChecksPassed) {
    process.exitCode = 1;
  }
} finally {
  socket?.close();
  if (chrome.exitCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await Promise.race([exited, delay(3000)]);
  }
  await Promise.all([
    rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    rm(testFilesDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  ]);
}
