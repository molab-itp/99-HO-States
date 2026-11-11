#!/usr/bin/env node
// Claude Code Stop hook: appends each finished exchange to Log.md.
//
// The final reply reaches the transcript after the hook fires, so the hook starts a
// detached copy of this script that waits for the reply before writing.
//
//   log-turn.js                               hook mode: reads the hook's JSON on stdin
//   log-turn.js --write <transcript> <log>    writes every exchange not yet logged
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const POLL_MS = 500;
const SETTLED_MS = 2000; // transcript unchanged for this long
const MAX_WAIT_MS = 60_000;

// API list prices, $ per million tokens. Cache writes are 1.25x input (5-minute) or 2x (1-hour);
// cache reads default to 0.1x input unless listed. Prefix-matched against the model id.
const PRICES = [
  ['claude-fable-5-1', { in: 10, out: 50, read: 0.25 }],
  ['claude-mythos-5-1', { in: 10, out: 50, read: 0.25 }],
  ['claude-fable-5', { in: 10, out: 50 }],
  ['claude-mythos-5', { in: 10, out: 50 }],
  ['claude-opus-5-5', { in: 4, out: 20, read: 0.2 }],
  ['claude-opus-5', { in: 5, out: 25 }],
  ['claude-opus-4', { in: 5, out: 25 }],
  ['claude-sonnet-5-5', { in: 2, out: 10, read: 0.2 }],
  ['claude-sonnet-5', { in: 2, out: 10 }],
  ['claude-sonnet-4', { in: 3, out: 15 }],
  ['claude-haiku-5-5', { in: 0.1, out: 0.5 }],
  ['claude-haiku-4', { in: 1, out: 5 }],
];

const blocks = (e) =>
  typeof e.message.content === 'string' ? [{ type: 'text', text: e.message.content }] : e.message.content;
const textOf = (e) =>
  blocks(e)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
const cleanPrompt = (e) =>
  textOf(e)
    .replace(/<(system-reminder|ide_selection)>[\s\S]*?<\/\1>/g, '')
    .replace(/<\/?pasted_content[^>]*>/g, '')
    .trim();
// A real prompt has text of its own and no tool_result.
const isPrompt = (e) =>
  e.type === 'user' &&
  !e.isMeta &&
  !e.isSidechain &&
  !blocks(e).some((b) => b.type === 'tool_result') &&
  cleanPrompt(e);
const isReply = (e) => e.type === 'assistant' && !e.isSidechain;

// Usage and cost of the assistant messages in entries. A message is split over several
// transcript entries that repeat its usage, so each message id is counted once.
function costOf(entries) {
  const messages = new Map();
  for (const e of entries)
    if (e.type === 'assistant' && e.message?.usage) messages.set(e.message.id ?? e.uuid, e.message);
  const t = { cost: 0, in: 0, out: 0, write: 0, read: 0, unpriced: new Set() };
  for (const { model, usage: u } of messages.values()) {
    const price = PRICES.find(([id]) => model?.startsWith(id))?.[1];
    const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const write5m = (u.cache_creation_input_tokens ?? 0) - write1h;
    const [inp, out, read] = [u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_read_input_tokens ?? 0];
    t.in += inp;
    t.out += out;
    t.write += write5m + write1h;
    t.read += read;
    if (!price) {
      if (model && model !== '<synthetic>') t.unpriced.add(model);
      continue;
    }
    const dollars =
      inp * price.in +
      out * price.out +
      write5m * price.in * 1.25 +
      write1h * price.in * 2 +
      read * (price.read ?? price.in * 0.1);
    t.cost += (dollars / 1e6) * (u.speed === 'fast' ? 2 : 1);
  }
  return t;
}

// Lapse time from the prompt to the turn's last timestamped entry, e.g. "1m 05s".
function lapseOf(prompt, turn) {
  const end = turn.findLast((e) => e.timestamp)?.timestamp;
  const ms = end ? Date.parse(end) - Date.parse(prompt.timestamp) : 0;
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}h ${pad(m)}m ${pad(sec)}s` : m ? `${m}m ${pad(sec)}s` : `${sec}s`;
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const costLine = (lapse, turn, session) =>
  `*Time: ${lapse} · Cost: $${turn.cost.toFixed(4)} (input ${k(turn.in)}, output ${k(turn.out)}, cache write ${k(turn.write)}, cache read ${k(turn.read)})` +
  ` · session $${session.cost.toFixed(4)}` +
  (turn.unpriced.size ? ` · no price for ${[...turn.unpriced].join(', ')}` : '') +
  '*';

function readEntries(transcript) {
  return fs.readFileSync(transcript, 'utf8').trim().split('\n').map(JSON.parse);
}

function isFinished(transcript) {
  if (Date.now() - fs.statSync(transcript).mtimeMs < SETTLED_MS) return false;
  const entries = readEntries(transcript);
  const last = entries.findLast((e) => isReply(e) || isPrompt(e));
  return Boolean(last) && isReply(last) && textOf(last) !== '' && !blocks(last).some((b) => b.type === 'tool_use');
}

async function write(transcript, logFile) {
  const started = Date.now();
  while (!isFinished(transcript) && Date.now() - started < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  const stateFile = `${logFile}.state`;
  let state = '';
  try {
    state = fs.readFileSync(stateFile, 'utf8').trim();
  } catch {}

  const entries = readEntries(transcript);
  const prompts = entries.flatMap((e, i) => (isPrompt(e) ? [i] : []));
  const done = prompts.findIndex((i) => entries[i].uuid === state);
  for (const [n, start] of prompts.entries()) {
    if (n <= done) continue;
    const turn = entries.slice(start + 1, prompts[n + 1]);
    const reply = turn.filter(isReply).map(textOf).filter(Boolean).join('\n\n');
    const when = new Date(entries[start].timestamp).toLocaleString();
    const cost = costLine(lapseOf(entries[start], turn), costOf(turn), costOf(entries.slice(0, prompts[n + 1])));
    fs.appendFileSync(
      logFile,
      `\n---\n\n## User (${when})\n\n\`\`\`\n${cleanPrompt(entries[start])}\n\`\`\`\n\n## Assistant\n\n${reply}\n\n${cost}\n`,
    );
    fs.writeFileSync(stateFile, entries[start].uuid);
  }
}

if (process.argv[2] === '--write') {
  write(process.argv[3], process.argv[4]);
} else {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const logFile = process.env.CHAT_LOG || path.join(input.cwd, 'Log.md');
  spawn(process.execPath, [__filename, '--write', input.transcript_path, logFile], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}
