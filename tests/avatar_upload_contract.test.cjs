const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {
  MAX_AVATAR_INPUT_BYTES,
  MAX_AVATAR_PIXELS
} = require('../src/modules/auth/avatar.mjs');

const source = fs.readFileSync(path.join(__dirname, '../src/modules/auth/client.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createTestHarness({
  authReady = true,
  uploadResult = null,
  uploadError = null,
  onUpload = null,
  publicUrl = null
} = {}) {
  const calls = {
    bucket: null,
    bucketCalls: 0,
    upload: null,
    uploadCalls: 0,
    getPublicUrl: null,
    getPublicUrlCalls: 0
  };

  const storageFrom = (bucketName) => {
    calls.bucketCalls += 1;
    calls.bucket = bucketName;
    return {
      async upload(uploadPath, blob, options) {
        calls.uploadCalls += 1;
        calls.upload = { path: uploadPath, blob, options };
        if (onUpload) {
          return onUpload(uploadPath, blob, options);
        }
        if (uploadError) {
          return { data: null, error: uploadError };
        }
        return uploadResult ?? { data: { path: uploadPath }, error: null };
      },
      getPublicUrl(publicUrlPath) {
        calls.getPublicUrlCalls += 1;
        calls.getPublicUrl = { path: publicUrlPath };
        const resolvedUrl = publicUrl ?? `https://project.supabase.co/storage/v1/object/public/${bucketName}/${publicUrlPath}`;
        return { data: { publicUrl: resolvedUrl } };
      }
    };
  };

  const supabase = {
    auth: {
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user: null }, error: null }; }
    },
    storage: {
      from(bucketName) {
        return storageFrom(bucketName);
      }
    }
  };

  const testModule = { exports: {} };
  const context = {
    module: testModule,
    exports: testModule.exports,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    JSON,
    Map,
    Date,
    Intl,
    URL,
    Blob,
    require(name) {
      if (name === '@supabase/supabase-js') {
        return { createClient: () => supabase };
      }
      if (name === '../shared/config') {
        return {
          getPublicSupabaseConfig: () => ({
            url: 'https://project.supabase.co',
            key: 'anon-test-key',
            isReady: authReady
          })
        };
      }
      if (name === '../cart/store') {
        return { cartStorageKey: (id) => `cart:${id}` };
      }
      if (name === './avatar.mjs') {
        return require('../src/modules/auth/avatar.mjs');
      }
      throw new Error(`Unexpected import: ${name}`);
    }
  };

  vm.runInNewContext(compiled, context, { filename: 'auth-client.js' });
  return { client: testModule.exports, calls, supabase };
}

function withMockCanvas(fn, { width = 640, height = 480 } = {}) {
  return async () => {
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalDocument = globalThis.document;

    globalThis.createImageBitmap = async () => ({
      width,
      height,
      closeCalls: 0,
      close() { this.closeCalls++; }
    });

    globalThis.document = {
      createElement(tag) {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext() {
              return {
                drawImage() {}
              };
            },
            toBlob(callback, mime) {
              callback(new Blob(['simulated-webp-binary'], { type: mime }));
            }
          };
        }
        return null;
      }
    };

    try {
      await fn();
    } finally {
      globalThis.createImageBitmap = originalCreateImageBitmap;
      globalThis.document = originalDocument;
    }
  };
}

test('uploadAvatar contract: uploads prepared WebP blob to avatars bucket under userId/avatar.webp and returns versioned public URL', withMockCanvas(async () => {
  const userId = '11111111-2222-3333-4444-555555555555';
  const user = { id: userId };
  const file = new Blob(['raw-jpeg-bytes'], { type: 'image/jpeg' });
  const harness = createTestHarness();

  const returnedUrl = await harness.client.uploadAvatar(user, file);

  // Assert avatars bucket
  assert.equal(harness.calls.bucket, 'avatars');

  // Assert userId/avatar.webp path
  assert.equal(harness.calls.upload.path, `${userId}/avatar.webp`);

  // Assert prepared WebP blob
  assert.ok(harness.calls.upload.blob instanceof Blob);
  assert.equal(harness.calls.upload.blob.type, 'image/webp');

  // Assert upload options: contentType=image/webp, cacheControl=0, upsert=true
  assert.equal(harness.calls.upload.options.contentType, 'image/webp');
  assert.equal(harness.calls.upload.options.cacheControl, '0');
  assert.equal(harness.calls.upload.options.upsert, true);

  // Assert getPublicUrl path
  assert.equal(harness.calls.getPublicUrl.path, `${userId}/avatar.webp`);
  assert.equal(harness.calls.uploadCalls, 1);
  assert.equal(harness.calls.getPublicUrlCalls, 1);

  // Assert versioned public URL
  const parsed = new URL(returnedUrl);
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.pathname, `/storage/v1/object/public/avatars/${userId}/avatar.webp`);
  assert.ok(parsed.searchParams.has('v'), 'URL must contain version query parameter');
  assert.match(parsed.searchParams.get('v'), /^\d+$/, 'Version parameter should be a numeric timestamp');
}));

test('uploadAvatar contract: propagates upload error without calling getPublicUrl when storage upload returns error', withMockCanvas(async () => {
  const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const user = { id: userId };
  const file = new Blob(['raw-png-bytes'], { type: 'image/png' });
  const storageError = new Error('Supabase storage RLS: upload denied');

  const harness = createTestHarness({ uploadError: storageError });

  await assert.rejects(
    harness.client.uploadAvatar(user, file),
    (err) => err === storageError
  );

  assert.equal(harness.calls.uploadCalls, 1);
  assert.equal(harness.calls.getPublicUrlCalls, 0, 'getPublicUrl must not be called when storage upload fails');
}));

test('uploadAvatar contract: propagates upload error without calling getPublicUrl when storage upload throws', withMockCanvas(async () => {
  const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const user = { id: userId };
  const file = new Blob(['raw-png-bytes'], { type: 'image/png' });

  const harness = createTestHarness({
    onUpload() {
      throw new Error('Storage network timeout');
    }
  });

  await assert.rejects(
    harness.client.uploadAvatar(user, file),
    /Storage network timeout/
  );

  assert.equal(harness.calls.uploadCalls, 1);
  assert.equal(harness.calls.getPublicUrlCalls, 0, 'getPublicUrl must not be called when storage upload throws');
}));

test('uploadAvatar contract: rejects invalid or oversized files before storage upload', async () => {
  const user = { id: 'test-user-id' };
  const harness = createTestHarness();

  // Invalid MIME types
  for (const invalidType of ['image/svg+xml', 'image/gif', 'application/pdf', 'text/plain']) {
    const invalidFile = new Blob(['invalid'], { type: invalidType });
    await assert.rejects(
      harness.client.uploadAvatar(user, invalidFile),
      /JPEG, PNG ou WebP/
    );
  }

  // Oversized file (> 5 MB)
  const oversizedFile = { type: 'image/png', size: MAX_AVATAR_INPUT_BYTES + 1 };
  await assert.rejects(
    harness.client.uploadAvatar(user, oversizedFile),
    /JPEG, PNG ou WebP/
  );

  // Null and missing file
  await assert.rejects(
    harness.client.uploadAvatar(user, null),
    /JPEG, PNG ou WebP/
  );

  // Verify that storage was never accessed
  assert.equal(harness.calls.uploadCalls, 0, 'upload must not be called for invalid or oversized files');
  assert.equal(harness.calls.bucketCalls, 0, 'storage bucket must not be accessed for invalid or oversized files');
  assert.equal(harness.calls.getPublicUrlCalls, 0, 'getPublicUrl must not be called for invalid or oversized files');
});

test('uploadAvatar contract: rejects oversized image resolution before storage upload', withMockCanvas(async () => {
  const user = { id: 'test-user-id' };
  const harness = createTestHarness();
  const file = new Blob(['dummy'], { type: 'image/jpeg' });

  await assert.rejects(
    harness.client.uploadAvatar(user, file),
    /20 megapixels/
  );

  assert.equal(harness.calls.uploadCalls, 0, 'storage upload must not be called for image exceeding pixel cap');
  assert.equal(harness.calls.bucketCalls, 0);
  assert.equal(harness.calls.getPublicUrlCalls, 0);
}, { width: MAX_AVATAR_PIXELS + 1, height: 1 }));

test('uploadAvatar contract: throws when Supabase client is not configured', async () => {
  const user = { id: 'test-user-id' };
  const file = new Blob(['bytes'], { type: 'image/jpeg' });
  const harness = createTestHarness({ authReady: false });

  await assert.rejects(
    harness.client.uploadAvatar(user, file),
    /Supabase não está configurado\./
  );

  assert.equal(harness.calls.uploadCalls, 0);
  assert.equal(harness.calls.bucketCalls, 0);
});
