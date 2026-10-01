const test = require('node:test');
const assert = require('node:assert/strict');

test('Chrome image audit accepts only HTTPS marketplace image hosts', async () => {
  const { isAllowedMarketplaceImage } = await import('../scripts/check-images-in-chrome.mjs');
  for (const image of [
    { platform: 'magalu', url: 'https://a-static.mlcdn.com.br/product/image.jpg' },
    { platform: 'magalu', url: 'https://cdn.magazineluiza.com.br/product/image.webp' },
    { platform: 'mercadolivre', url: 'https://http2.mlstatic.com/product/image.webp' },
    { platform: 'mercadolivre', url: 'https://cdn.mlstatic.com.br/product/image.webp' },
    { platform: 'amazon', url: 'https://m.media-amazon.com/images/I/item.jpg' },
    { platform: 'shopee', url: 'https://down-br.img.susercontent.com/file/item.webp' }
  ]) assert.equal(isAllowedMarketplaceImage(image), true, image.url);
});

test('Chrome image audit refuses deceptive hosts, credentials, custom ports, other stores and malformed URLs', async () => {
  const { isAllowedMarketplaceImage, checkImagesInChrome } = await import('../scripts/check-images-in-chrome.mjs');
  const rejected = [
    { platform: 'magalu', url: 'https://a-static.mlcdn.com.br.attacker.invalid/image.jpg' },
    { platform: 'mercadolivre', url: 'https://mlstatic.com.attacker.invalid/image.webp' },
    { platform: 'magalu', url: 'https://user:pass@a-static.mlcdn.com.br/image.jpg' },
    { platform: 'mercadolivre', url: 'https://http2.mlstatic.com:8443/image.webp' },
    { platform: 'mercadolivre', url: 'http://http2.mlstatic.com/image.webp' },
    { platform: 'amazon', url: 'https://m.media-amazon.com.attacker.invalid/images/I/item.jpg' },
    { platform: 'shopee', url: 'https://down-br.img.susercontent.com.attacker.invalid/file/item.webp' },
    { platform: 'magalu', url: 'not a URL' }
  ];
  for (const image of rejected) assert.equal(isAllowedMarketplaceImage(image), false, image.url);
  await assert.rejects(checkImagesInChrome(rejected), /only HTTPS image URLs/);
});

test('Chrome image audit retains transport failure details when no HTTP response exists', async () => {
  const { describeImageResult } = await import('../scripts/check-images-in-chrome.mjs');
  const result = describeImageResult({
    url: 'https://a-static.mlcdn.com.br/product/image.jpg?token=private',
    naturalWidth: 0, naturalHeight: 0, timedOut: false
  }, undefined, { errorText: 'net::ERR_BLOCKED_BY_RESPONSE', blockedReason: 'corp-not-allowed', canceled: false });
  assert.deepEqual(result, {
    host: 'a-static.mlcdn.com.br', path: '/product/image.jpg',
    networkError: 'net::ERR_BLOCKED_BY_RESPONSE', blockedReason: 'corp-not-allowed', canceled: false,
    naturalWidth: 0, naturalHeight: 0, timedOut: false, ok: false
  });
});

test('Mercado Livre image audit flags a mismatched listing ID for review without assuming other formats', async () => {
  const { classifyImageIdentity } = await import('../scripts/check-images-in-chrome.mjs');
  assert.equal(classifyImageIdentity({
    platform: 'mercadolivre', externalId: 'MLB3299039091',
    url: 'https://http2.mlstatic.com/D_Q_NP_832434-MLB3299039091-O.webp'
  }), 'match');
  assert.equal(classifyImageIdentity({
    platform: 'mercadolivre', externalId: 'MLB3299039091',
    url: 'https://http2.mlstatic.com/D_Q_NP_832434-MLB98472312945-O.webp'
  }), 'mismatch');
  assert.equal(classifyImageIdentity({
    platform: 'mercadolivre', externalId: 'MLB3299039091',
    url: 'https://http2.mlstatic.com/images/item.webp'
  }), 'unverifiable');
  assert.equal(classifyImageIdentity({
    platform: 'magalu', externalId: 'cghe07c3d6',
    url: 'https://a-static.mlcdn.com.br/item.jpg'
  }), 'unverifiable');
});
