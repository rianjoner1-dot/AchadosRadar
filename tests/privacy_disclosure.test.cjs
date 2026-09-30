const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const privacyPage = fs.readFileSync(path.join(__dirname, '../src/pages/privacidade.astro'), 'utf8');
const termsPage = fs.readFileSync(path.join(__dirname, '../src/pages/termos.astro'), 'utf8');
const footer = fs.readFileSync(path.join(__dirname, '../src/components/Footer.astro'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../src/layouts/Layout.astro'), 'utf8');

test('privacy page distinguishes enabled development behavior from planned account features', () => {
  assert.match(privacyPage, /cadastro e sincroniza&ccedil;&atilde;o de conta est&atilde;o desativados/);
  assert.match(privacyPage, /Lista local/);
  assert.match(privacyPage, /integra&ccedil;&atilde;o Supabase[\s\S]*?aguarda revis&atilde;o e configura&ccedil;&atilde;o/);
  assert.match(privacyPage, /envio de foto de perfil n&atilde;o est&aacute; habilitado/);
  assert.match(privacyPage, /controlador[\s\S]*?canal oficial/);
  assert.match(privacyPage, /cookies ou tecnologias semelhantes/);
});

test('terms do not claim account cart sync is active before Supabase is enabled', () => {
  assert.match(termsPage, /sincroniza&ccedil;&atilde;o entre dispositivos permanece desativada/);
  assert.match(termsPage, /Cada item &eacute; aberto individualmente na loja parceira/);
  assert.doesNotMatch(termsPage, /usu&aacute;rios autenticados podem sincroniz&aacute;-la com a conta/);
});

test('footer does not imply affiliate-program authorization before confirmation', () => {
  assert.match(footer, /Vitrine independente para comparar ofertas/);
  assert.match(footer, /<span class="group-title">Marketplaces<\/span>/);
  assert.doesNotMatch(footer, /marketplaces autorizados|Lojas Parceiras/);
});

test('terms metadata describes affiliate links without claiming program approval', () => {
  assert.match(termsPage, /description = "Termos de uso[^"]*links que podem gerar comiss/);
  assert.doesNotMatch(termsPage, /description = "[^"]*afiliado oficial/);
});

test('default page metadata describes observed offers without promising live verification', () => {
  assert.match(layout, /description = "Compare ofertas observadas/);
  assert.doesNotMatch(layout, /achados verificados com pre.{1,3}os atualizados/);
});
