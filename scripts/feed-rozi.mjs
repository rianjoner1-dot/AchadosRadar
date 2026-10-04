import fs from 'node:fs';
import path from 'node:path';

const roziHistPath = 'C:/Users/joner/Documents/rozisemijoias/robo-seguir-instagram/data/historico_seguidos.json';
const roziHist = fs.existsSync(roziHistPath) ? JSON.parse(fs.readFileSync(roziHistPath, 'utf8')) : {};

const assocFile = 'C:/Users/joner/Documents/associados/robo-seguir-instagram/data/fila_csv/super_lote_embaralhado_1533_2026-10-04.csv';
const lines = fs.readFileSync(assocFile, 'utf8').trim().split('\n');

const freshForRozi = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const u = parts[0].replace(/['"@\s]/g, '').trim().toLowerCase();
  if (u && !roziHist[u]) {
    freshForRozi.push(line);
  }
}

console.log('Total de perfis frescos para Rozi a partir do lote associados:', freshForRozi.length);

const outPath = 'C:/Users/joner/Documents/rozisemijoias/robo-seguir-instagram/data/fila_csv/super_lote_fresco_rozi_500.csv';
fs.writeFileSync(outPath, ['Username,Fullname,Origem', ...freshForRozi.slice(0, 500)].join('\n'), 'utf8');

// Also clean up any exhausted csvs from Rozi's fila
const old90 = 'C:/Users/joner/Documents/rozisemijoias/robo-seguir-instagram/data/fila_csv/super_lote_embaralhado_rozi_90_2026-10-04.csv';
if (fs.existsSync(old90)) {
  fs.unlinkSync(old90);
}
const old180 = 'C:/Users/joner/Documents/rozisemijoias/robo-seguir-instagram/data/fila_csv/lote_extraidos_rozi_180.csv';
if (fs.existsSync(old180)) {
  fs.unlinkSync(old180);
}

console.log('✅ Lote com 500 perfis inéditos gerado com sucesso para Rozi!');
