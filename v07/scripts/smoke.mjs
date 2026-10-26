#!/usr/bin/env node
// Headless smoke test for the v07 React app: boots the Vite dev server in-process, drives it with
// Playwright/Chromium through the main flows, and screenshots each step. Run with
// `npm run smoke`. Exits non-zero (and prints them) if the page logs any console errors.
//
// It never talks to a real Supabase project. The app is pointed at a made-up address, and every
// request to it (Auth, the `profiles` table, RPCs, Storage, the Edge Function, and the Realtime
// websocket) is answered here from a small in-memory stand-in. So this checks the app's own
// behaviour, not the database, its policies or the email flow.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const screenshotDir = path.join(rootDir, 'playwright', 'screenshots');
const PORT = 5187;
const SUPABASE = 'https://smoke.supabase.test';

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADA = 'bbbbbbbb-0000-4000-8000-000000000002';
const GUEST = 'cdef0123-0000-4000-8000-000000000003';
const NEWCOMER = 'dddddddd-0000-4000-8000-000000000004';
const NEW_GUEST = 'eeeeeeee-0000-4000-8000-000000000005';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

function profile(id, fields) {
  return {
    id,
    email: null,
    display_name: null,
    avatar_url: null,
    photo_path: null,
    photo_thumb_path: null,
    photo_original_path: null,
    caption: null,
    is_anonymous: false,
    created_at: ago(5000),
    last_sign_in_at: ago(600),
    last_seen_at: null,
    last_sign_out_at: null,
    ...fields,
  };
}

/** The in-memory stand-in for the Supabase project. */
function fakeSupabase() {
  const db = {
    profiles: [
      profile(ADA, { email: 'ada@example.com', display_name: 'Ada Lovelace', caption: 'First programmer', last_seen_at: ago(5) }),
      profile(GUEST, { is_anonymous: true, last_seen_at: ago(60 * 26) }),
    ],
    /** Storage objects in the `avatars` bucket, by path. */
    files: new Map(),
    /** Who the page is signed in as. */
    userID: null,
    /** Realtime channels the page has joined: `{ send, topic, joinRef }`. */
    channels: [],
    emailsSent: [],
  };

  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': '*',
  };
  const json = (route, body, status = 200) =>
    route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  const empty = (route) => route.fulfill({ status: 204, headers: cors });

  const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

  function session(id, fields) {
    db.userID = id;
    if (!db.profiles.some((p) => p.id === id)) db.profiles.push(profile(id, fields));
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const user = {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: fields.email ?? '',
      is_anonymous: Boolean(fields.is_anonymous),
      app_metadata: {},
      user_metadata: {},
      created_at: ago(5000),
    };
    return {
      access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: id, role: 'authenticated', exp: expiresAt })}.smoke`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: 'smoke-refresh',
      user,
    };
  }

  /** Sends a `profiles` change to the page, as Realtime's Postgres Changes would. */
  function push(type, record, oldRecord = {}) {
    for (const channel of db.channels) {
      channel.send([
        channel.joinRef,
        null,
        channel.topic,
        'postgres_changes',
        {
          ids: [1],
          data: {
            schema: 'public',
            table: 'profiles',
            commit_timestamp: new Date().toISOString(),
            type,
            columns: [],
            record,
            old_record: oldRecord,
            errors: null,
          },
        },
      ]);
    }
  }

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const at = `${method} ${url.pathname}`;
    if (method === 'OPTIONS') return empty(route);

    // --- Auth ---
    if (at === 'POST /auth/v1/otp') {
      db.emailsSent.push(request.postDataJSON().email);
      return json(route, {});
    }
    if (at === 'POST /auth/v1/verify') {
      const { email, token } = request.postDataJSON();
      if (token !== '123456') {
        return json(route, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
      }
      return json(route, session(ME, { email, last_seen_at: ago(1) }));
    }
    if (at === 'POST /auth/v1/signup') {
      return json(route, session(NEW_GUEST, { is_anonymous: true }));
    }
    if (at === 'POST /auth/v1/logout') {
      db.userID = null;
      return empty(route);
    }

    // --- RPCs and the profiles table ---
    if (at === 'POST /rest/v1/rpc/touch_last_seen') {
      const me = db.profiles.find((p) => p.id === db.userID);
      if (me) me.last_seen_at = new Date().toISOString();
      return empty(route);
    }
    if (at === 'POST /rest/v1/rpc/is_admin') return json(route, db.userID === ME);
    if (at === 'POST /rest/v1/rpc/mark_signed_out') return empty(route);
    if (at === 'GET /rest/v1/profiles') {
      const rows = [...db.profiles].sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
      return json(route, rows);
    }
    if (at === 'PATCH /rest/v1/profiles') {
      const id = url.searchParams.get('id').replace('eq.', '');
      const row = Object.assign(db.profiles.find((p) => p.id === id), request.postDataJSON());
      // `.select().single()` asks for the updated row back, as one object.
      if (!(request.headers().prefer ?? '').includes('return=representation')) return empty(route);
      return json(route, (request.headers().accept ?? '').includes('pgrst.object') ? row : [row]);
    }

    // --- Storage ---
    const object = url.pathname.match(/^\/storage\/v1\/object\/(?:public\/)?avatars\/(.+)$/);
    if (object && method === 'POST') {
      // supabase-js sends a multipart form; the JPEG is the part with a content type.
      const body = request.postDataBuffer();
      const boundary = body.subarray(0, body.indexOf('\r\n'));
      const header = 'Content-Type: image/jpeg\r\n\r\n';
      const start = body.indexOf(header) + header.length;
      const end = body.indexOf(Buffer.concat([Buffer.from('\r\n'), boundary]), start);
      db.files.set(object[1], body.subarray(start, end));
      return json(route, { Key: `avatars/${object[1]}`, Id: object[1] });
    }
    if (object && method === 'GET') {
      const file = db.files.get(object[1]);
      if (!file) return json(route, { error: 'not_found' }, 404);
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/jpeg', body: file });
    }
    if (at === 'DELETE /storage/v1/object/avatars') {
      for (const prefix of request.postDataJSON().prefixes) db.files.delete(prefix);
      return json(route, []);
    }

    // --- The delete-user Edge Function ---
    if (at === 'POST /functions/v1/delete-user') {
      const id = request.postDataJSON().user_id;
      db.profiles = db.profiles.filter((p) => p.id !== id);
      push('DELETE', {}, { id });
      return json(route, { deleted: id });
    }

    return json(route, { error: `smoke.mjs has no answer for ${at}` }, 500);
  }

  /** Speaks enough of Realtime's protocol (Phoenix, serializer 2.0.0) to hold a subscription open. */
  function realtime(socket) {
    const send = (message) => socket.send(JSON.stringify(message));
    socket.onMessage((text) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(text);
      if (event === 'phx_join') {
        const changes = (payload.config?.postgres_changes ?? []).map((c, index) => ({ ...c, id: index + 1 }));
        send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: changes } }]);
        send([joinRef, null, topic, 'system', { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL', channel: topic.replace('realtime:', '') }]);
        db.channels.push({ send, topic, joinRef });
      } else if (event === 'phx_leave') {
        db.channels = db.channels.filter((c) => c.topic !== topic);
        send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
      } else if (event === 'heartbeat') {
        send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
      }
    });
  }

  return { db, handle, realtime, push };
}

async function startServer(env) {
  for (const [name, value] of Object.entries(env)) process.env[name] = value;
  return createServer({
    root: rootDir,
    // An empty folder, so the developer's own `.env.local` is never picked up.
    envDir: mkdtempSync(path.join(tmpdir(), 'v07-smoke-')),
    server: { port: PORT, strictPort: true },
    logLevel: 'error',
  }).then((server) => server.listen());
}

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const watch = (page) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
  };
  const url = `http://localhost:${PORT}/`;
  let step = 0;
  const shot = (page, name) =>
    page.screenshot({ path: path.join(screenshotDir, `${String(++step).padStart(2, '0')}-${name}.png`) });

  // --- Without a Supabase URL, the app explains itself. ---
  let server = await startServer({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(page);
    await page.goto(url);
    await page.getByText('Supabase not configured').waitFor();
    await page.getByText("VITE_SUPABASE_URL isn't set to a valid URL.").waitFor();
    await shot(page, 'setup-required');
    await page.close();
    console.log('ok  setup required');
  } finally {
    await server.close();
  }

  // --- With one: sign in, list, live updates, admin delete, photos, sign out. ---
  server = await startServer({ VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_smoke' });
  try {
    const supabase = fakeSupabase();
    const { db } = supabase;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(page);
    await page.route(`${SUPABASE}/**`, supabase.handle);
    await page.routeWebSocket(/smoke\.supabase\.test\/realtime/, supabase.realtime);
    await page.goto(url);

    // Email code sign-in.
    await page.getByRole('heading', { name: 'HO Users' }).waitFor();
    const emailButton = page.getByRole('button', { name: 'Email Me a Sign-In Code' });
    assert(await emailButton.isDisabled(), 'the email button should be disabled without an address');
    await shot(page, 'sign-in');
    await page.getByLabel('Email').fill('  Me@Example.com ');
    await emailButton.click();
    await page.getByRole('heading', { name: 'Check your email' }).waitFor();
    await page.getByText('Enter the 6-digit code sent to me@example.com.').waitFor();
    assert(db.emailsSent[0] === 'me@example.com', `the code went to ${db.emailsSent[0]}`);

    // A wrong code shows the error and clears the field; the right one signs in when complete.
    await page.getByLabel('Sign-in code').fill('000000');
    await page.getByText('Token has expired or is invalid').waitFor();
    assert((await page.getByLabel('Sign-in code').inputValue()) === '', 'a wrong code should be cleared');
    await shot(page, 'wrong-code');
    // The browser logs the failed request itself; that one is expected.
    assert(consoleErrors.length === 1 && consoleErrors[0].includes('403'), `console errors: ${consoleErrors}`);
    consoleErrors.length = 0;
    await page.getByLabel('Sign-in code').fill('123 456');
    await page.locator('.nav-title', { hasText: 'HOS-Lobby' }).waitFor();
    console.log('ok  email code sign-in');

    // The list: most recently active first, guests named by their id.
    await page.locator('.list-item').nth(2).waitFor();
    const names = await page.locator('.profile-name').allTextContents();
    assert(names.join('|') === 'me@example.com|Ada Lovelace|Guest CDEF', `list order: ${names.join('|')}`);
    assert((await page.locator('.list-item').first().locator('.you-badge').count()) === 1, 'my row should say You');
    await page.getByText('Active yesterday').waitFor();
    await page.getByText('ada@example.com').waitFor();
    await page.locator('.profile-caption', { hasText: 'First programmer' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.error-text'));
    // v06.155's totals: the guest was last seen 26 hours ago.
    const counts = async () => (await page.locator('.user-count').allTextContents()).join('|');
    assert((await counts()) === '3 Total Users|2 Active in 24h', `user counts: ${await counts()}`);
    await shot(page, 'list');
    console.log('ok  users list');

    // Live updates.
    assert(db.channels.length === 1, `expected one live subscription, found ${db.channels.length}`);
    supabase.push('INSERT', profile(NEWCOMER, { email: 'new@example.com', last_seen_at: null }));
    await page.getByRole('status').getByText('new@example.com joined').waitFor();
    await shot(page, 'banner-joined');
    assert((await page.locator('.profile-name').last().textContent()) === 'new@example.com', 'a never-seen user goes last');
    assert((await counts()) === '4 Total Users|2 Active in 24h', `user counts after a join: ${await counts()}`);
    const ada = db.profiles.find((p) => p.id === ADA);
    supabase.push('UPDATE', { ...ada, last_seen_at: new Date().toISOString() });
    await page.waitForFunction(() => document.querySelector('.profile-name')?.textContent === 'Ada Lovelace');
    assert((await page.getByRole('status').textContent()) === 'new@example.com joined', 'a last-seen bump is not announced');
    supabase.push('UPDATE', { ...ada, last_sign_out_at: new Date().toISOString() });
    await page.getByRole('status').getByText('Ada Lovelace signed out').waitFor();
    supabase.push('UPDATE', { ...ada, last_sign_out_at: new Date().toISOString(), last_sign_in_at: new Date(Date.now() + 5000).toISOString() });
    await page.getByRole('status').getByText('Ada Lovelace signed in').waitFor();
    console.log('ok  live updates');

    // Admin delete.
    await page.getByRole('button', { name: 'Delete Guest CDEF' }).click();
    await page.getByRole('heading', { name: 'Delete Guest CDEF?' }).waitFor();
    await shot(page, 'delete-dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();
    assert((await page.getByText('Guest CDEF').count()) === 1, 'Cancel should keep the user');
    await page.getByRole('button', { name: 'Delete Guest CDEF' }).click();
    await page.getByRole('button', { name: 'Delete User' }).click();
    await page.getByText('Guest CDEF', { exact: true }).waitFor({ state: 'detached' });
    assert((await page.getByRole('button', { name: 'Delete me@example.com' }).count()) === 0, "admins can't delete themselves");
    console.log('ok  admin delete');

    // Someone else's profile has no photo buttons.
    await page.getByRole('button', { name: /Ada Lovelace/ }).first().click();
    await page.locator('.nav-title', { hasText: 'Ada Lovelace' }).waitFor();
    assert((await page.getByText('Choose Photo').count()) === 0, "another user's photo can't be changed");
    await page.locator('.detail-caption', { hasText: 'First programmer' }).waitFor();
    assert((await page.getByLabel('Caption').count()) === 0, "another user's caption can't be edited");
    await page.goBack();
    await page.locator('.nav-title', { hasText: 'HOS-Lobby' }).waitFor();

    // My profile: pick a photo, crop it, upload.
    await page.getByRole('button', { name: /me@example\.com/ }).first().click();
    await page.getByText('Choose Photo').waitFor();
    assert(page.url().endsWith(`#/user/${ME}`), `the profile's address is ${page.url()}`);
    const me = () => db.profiles.find((p) => p.id === ME);

    // Caption: Save shows once it differs, Return saves it trimmed, and blank clears it.
    const caption = page.getByLabel('Caption');
    assert((await page.getByRole('button', { name: 'Save' }).count()) === 0, 'no Save before an edit');
    await caption.fill('  Hello from the web  ');
    await page.getByRole('button', { name: 'Save' }).waitFor();
    await shot(page, 'caption-editing');
    await caption.press('Enter');
    await page.getByRole('button', { name: 'Save' }).waitFor({ state: 'detached' });
    assert(me().caption === 'Hello from the web', `caption saved as ${JSON.stringify(me().caption)}`);
    assert((await caption.inputValue()) === 'Hello from the web', 'the field shows the stored caption');
    assert((await caption.getAttribute('maxlength')) === '100', 'captions are capped at 100 characters');
    await caption.fill('   ');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Save' }).waitFor({ state: 'detached' });
    assert(me().caption === null, `a blank caption should clear it, found ${JSON.stringify(me().caption)}`);
    await caption.fill('Hello from the web');
    await caption.press('Enter');
    await page.getByRole('button', { name: 'Save' }).waitFor({ state: 'detached' });
    console.log('ok  edit caption');
    // Any picture will do; this one is 390 × 844.
    const picture = await page.screenshot();
    await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: picture });
    await page.getByRole('dialog', { name: 'Crop Photo' }).waitFor();
    await page.locator('.crop-rect').waitFor();
    assert(await page.getByRole('button', { name: 'Reset' }).isDisabled(), 'Reset is off until the crop changes');
    assert(db.files.size === 0, 'nothing uploads before the cropper is done');

    // Drag the bottom-right corner to the middle of the image, then the rectangle to the right.
    const image = await page.locator('.crop-image').boundingBox();
    const drag = async (fromX, fromY, toX, toY) => {
      await page.mouse.move(image.x + fromX * image.width, image.y + fromY * image.height);
      await page.mouse.down();
      await page.mouse.move(image.x + toX * image.width, image.y + toY * image.height, { steps: 5 });
      await page.mouse.up();
    };
    await drag(1, 1, 0.5, 0.5);
    await drag(0.25, 0.25, 0.9, 0.25);
    const rect = await page.locator('.crop-rect').boundingBox();
    const near = (a, b) => Math.abs(a - b) < 2;
    assert(near(rect.width, image.width / 2) && near(rect.height, image.height / 2), 'the crop should be a quarter of the image');
    assert(near(rect.x + rect.width, image.x + image.width) && near(rect.y, image.y), 'the crop should stop at the right edge');
    await shot(page, 'cropper');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Restore Original' }).waitFor();
    assert(db.files.size === 3, `expected full, thumb and original in the bucket, found ${[...db.files.keys()]}`);
    assert(me().photo_path.startsWith(`${ME}/`) && me().photo_path.endsWith('-full.jpg'), `photo_path is ${me().photo_path}`);
    assert(me().photo_original_path.endsWith('-original.jpg'), `photo_original_path is ${me().photo_original_path}`);
    const shownSize = () =>
      page.locator('.detail-photo img:not([hidden])').evaluate((img) => `${img.naturalWidth}x${img.naturalHeight}`);
    await page.waitForFunction(() => document.querySelector('.detail-photo img:not([hidden])')?.naturalWidth > 0);
    assert((await shownSize()) === '195x422', `the cropped photo is ${await shownSize()}`);
    await shot(page, 'profile-cropped');
    const thumbSize = await page.evaluate(async (thumbURL) => {
      const bitmap = await createImageBitmap(await (await fetch(thumbURL)).blob());
      return `${bitmap.width}x${bitmap.height}`;
    }, `${SUPABASE}/storage/v1/object/public/avatars/${me().photo_thumb_path}`);
    assert(thumbSize === '195x195', `the thumbnail is ${thumbSize}`);
    console.log('ok  choose and crop photo');

    // Crop again starts from the original; Reset + Done is the same as Restore Original.
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.locator('.crop-rect').waitFor();
    await drag(0, 0, 0.5, 0);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction(() => document.querySelector('.detail-photo img:not([hidden])')?.naturalHeight === 844);
    assert((await shownSize()) === '195x844', `the re-cropped photo is ${await shownSize()}`);
    assert(db.files.size === 3, `the first crop should be deleted, found ${[...db.files.keys()]}`);

    const original = me().photo_original_path;
    await page.getByRole('button', { name: 'Restore Original' }).click();
    await page.getByRole('button', { name: 'Restore Original' }).waitFor({ state: 'detached' });
    assert(me().photo_path === original && me().photo_original_path === null, 'the original should be the photo again');
    assert(db.files.size === 2, `expected the original and its thumb, found ${[...db.files.keys()]}`);
    await page.waitForFunction(() => document.querySelector('.detail-photo img:not([hidden])')?.naturalWidth === 390);
    console.log('ok  re-crop and restore original');

    await page.getByRole('button', { name: 'Remove' }).click();
    await page.getByText('Choose Photo').waitFor();
    assert(db.files.size === 0 && me().photo_path === null, 'Remove should delete every file');
    console.log('ok  remove photo');

    // A file that isn't an image.
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.getByText("That photo couldn't be read.").waitFor();

    // A profile's address works on its own, and Back from it leads to the list.
    await page.reload();
    await page.locator('.nav-title', { hasText: 'me@example.com' }).waitFor();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.locator('.nav-title', { hasText: 'HOS-Lobby' }).waitFor();
    await page.locator('.profile-caption', { hasText: 'Hello from the web' }).waitFor();
    assert(!page.url().includes('#'), `the list's address is ${page.url()}`);
    console.log('ok  profile address');

    // Sign out, then back in as a guest.
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.getByRole('heading', { name: 'HO Users' }).waitFor();
    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await page.locator('.nav-title', { hasText: 'HOS-Lobby' }).waitFor();
    await page.locator('.list-item').first().waitFor();
    assert((await page.locator('.profile-name').first().textContent()) === 'Guest EEEE', 'the guest should top the list');
    assert((await page.locator('.list-delete').count()) === 0, 'a guest is not an admin');
    await shot(page, 'guest');
    console.log('ok  sign out and guest sign-in');

    // An admin deleting the signed-in user sends them back to sign-in.
    supabase.push('DELETE', {}, { id: NEW_GUEST });
    await page.getByRole('heading', { name: 'HO Users' }).waitFor();
    console.log('ok  deleted while signed in');

    // Wide window, dark mode.
    await page.close();
    const desktop = await browser.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: 'dark' });
    watch(desktop);
    await desktop.route(`${SUPABASE}/**`, supabase.handle);
    await desktop.routeWebSocket(/smoke\.supabase\.test\/realtime/, supabase.realtime);
    await desktop.goto(url);
    await shot(desktop, 'sign-in-dark');
    await desktop.getByRole('button', { name: 'Continue as Guest' }).click();
    await desktop.locator('.list-item').first().waitFor();
    await shot(desktop, 'list-dark');
    await desktop.close();
  } catch (error) {
    // Leave a picture of where it stopped.
    for (const page of browser.contexts().flatMap((context) => context.pages())) await shot(page, 'failed');
    for (const e of consoleErrors) console.error('console error:', e);
    throw error;
  } finally {
    await server.close();
    await browser.close();
  }

  if (consoleErrors.length > 0) {
    console.error('\nConsole errors detected:');
    for (const e of consoleErrors) console.error(' -', e);
    process.exitCode = 1;
    return;
  }
  console.log('\nNo console errors. Smoke test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
