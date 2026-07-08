// api/drug-ai-claude.js — Anthropic Claude provider
// Same interface as drug-ai-details.js (Gemini). Streams plain text back.
// Requires ANTHROPIC_API_KEY in Vercel environment variables.

export const config = { runtime: 'edge', regions: ['iad1'] };

import { buildPrompt } from './_lib/buildPrompt.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  let prompt, maxTokens;
  try { ({ prompt, maxTokens } = buildPrompt(body)); }
  catch (e) { return new Response(JSON.stringify({ error: e.error || 'Bad request.' }), { status: e.status || 400, headers: { 'Content-Type': 'application/json' } }); }

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'messages-2023-12-15',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream:     true,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Unexpected server error.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  if (!claudeRes.ok || !claudeRes.body) {
    let detail = '';
    try { detail = await claudeRes.text(); } catch {}
    console.error('Claude API error:', claudeRes.status, detail);
    const isQuota = claudeRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'Claude API rate limit reached. Please wait a moment and try again.'
        : 'Failed to reach the Claude AI service.',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  // Claude SSE: events with type "content_block_delta" carry the text deltas.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader  = claudeRes.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); continue; }
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const evt = JSON.parse(dataStr);
              if (eventType === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(evt.delta.text));
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error('Claude stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
