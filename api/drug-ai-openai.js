// api/drug-ai-openai.js — OpenAI ChatGPT provider
// Same interface as drug-ai-details.js. Streams plain text back.
// Requires OPENAI_API_KEY in Vercel environment variables.

export const config = { runtime: 'edge', regions: ['iad1'] };

import { buildPrompt } from './_lib/buildPrompt.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with an OPENAI_API_KEY.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  let prompt, maxTokens;
  try { ({ prompt, maxTokens } = buildPrompt(body)); }
  catch (e) { return new Response(JSON.stringify({ error: e.error || 'Bad request.' }), { status: e.status || 400, headers: { 'Content-Type': 'application/json' } }); }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  let openaiRes;
  try {
    openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
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

  if (!openaiRes.ok || !openaiRes.body) {
    let detail = '';
    try { detail = await openaiRes.text(); } catch {}
    console.error('OpenAI API error:', openaiRes.status, detail);
    const isQuota = openaiRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'OpenAI rate limit reached. Please wait a moment and try again.'
        : 'Failed to reach the OpenAI service.',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  // OpenAI SSE: data lines contain JSON with choices[0].delta.content
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader  = openaiRes.body.getReader();

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
        console.error('OpenAI stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
