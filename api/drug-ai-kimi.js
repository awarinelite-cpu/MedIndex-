// api/drug-ai-kimi.js — Moonshot AI (Kimi) provider
// Kimi's API is also OpenAI-compatible.
// Requires KIMI_API_KEY in Vercel environment variables.

export const config = { runtime: 'edge', regions: ['iad1'] };

import { buildPrompt } from './_lib/buildPrompt.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with a KIMI_API_KEY.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  let prompt, maxTokens;
  try { ({ prompt, maxTokens } = buildPrompt(body)); }
  catch (e) { return new Response(JSON.stringify({ error: e.error || 'Bad request.' }), { status: e.status || 400, headers: { 'Content-Type': 'application/json' } }); }

  // moonshot-v1-8k is the fast/cheap model; moonshot-v1-32k for longer context
  const model = process.env.KIMI_MODEL || 'moonshot-v1-8k';

  let kimiRes;
  try {
    kimiRes = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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

  if (!kimiRes.ok || !kimiRes.body) {
    let detail = '';
    try { detail = await kimiRes.text(); } catch {}
    console.error('Kimi API error:', kimiRes.status, detail);
    const isQuota = kimiRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'Kimi rate limit reached. Please wait a moment and try again.'
        : 'Failed to reach the Kimi AI service.',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  // OpenAI-compatible SSE format
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader  = kimiRes.body.getReader();

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
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const evt = JSON.parse(dataStr);
              const content = evt?.choices?.[0]?.delta?.content;
              if (typeof content === 'string') controller.enqueue(encoder.encode(content));
            } catch {}
          }
        }
      } catch (err) {
        console.error('Kimi stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
