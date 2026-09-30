// scripts/verify-functions.cjs
// Verificador de orçamento de funções Serverless (Meta: <= 4, Limite rígido: < 12)

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const vercelOutputDir = path.join(projectRoot, '.vercel/output/functions');

function countFilesRecursive(dir, extensions = ['.js', '.ts', '.mjs', '.func']) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.func')) {
        count++;
      } else {
        count += countFilesRecursive(fullPath, extensions);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext) && !entry.name.startsWith('_') && !entry.name.endsWith('.d.ts')) {
        count++;
      }
    }
  }
  return count;
}

console.log('🔍 [Orçamento Vercel] Auditando contagem de funções serverless...');

// Prioriza artefato gerado pela Vercel se existir, senão audita a pasta api/
let functionCount = 0;
let sourceAudit = '';

if (fs.existsSync(vercelOutputDir)) {
  functionCount = countFilesRecursive(vercelOutputDir);
  sourceAudit = '.vercel/output/functions';
} else if (fs.existsSync(path.join(projectRoot, 'src/pages/api'))) {
  functionCount = countFilesRecursive(path.join(projectRoot, 'src/pages/api'), ['.js', '.ts', '.mjs']);
  sourceAudit = 'src/pages/api/ (estimativa antes do build)';
} else {
  functionCount = 0;
  sourceAudit = 'nenhuma pasta de funções detectada (modo 100% estático SSG)';
}

console.log(`📦 Fonte de auditoria: ${sourceAudit}`);
console.log(`📊 Contagem atual de funções: ${functionCount}`);

const TARGET_LIMIT = 4;
const HARD_LIMIT = 12;

if (functionCount >= HARD_LIMIT) {
  console.error(`❌ [FALHA DE ORÇAMENTO] O artefato gerou ${functionCount} funções! Limite máximo tolerado é < ${HARD_LIMIT}.`);
  process.exit(1);
}

if (functionCount > TARGET_LIMIT) {
  console.warn(`⚠️ [ALERTA DE ORÇAMENTO] O artefato possui ${functionCount} funções (meta de projeto é <= ${TARGET_LIMIT}).`);
} else {
  console.log(`✅ [ORÇAMENTO APROVADO] ${functionCount} funções (dentro da meta <= ${TARGET_LIMIT} e abaixo do teto de ${HARD_LIMIT}).`);
}

process.exit(0);
