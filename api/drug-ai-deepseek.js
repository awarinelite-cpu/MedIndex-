// api/drug-ai-deepseek.js — DeepSeek provider
// DeepSeek's API is OpenAI-compatible, so the streaming format is identical.
// Requires DEEPSEEK_API_KEY in Vercel environment variables.

export const config = { runtime: 'edge', regions: ['iad1'] };

import { buildPrompt } from './_lib/buildPrompt.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with a DEEPSEEK_API_KEY.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  let prompt, maxTokens;
  try { ({ prompt, maxTokens } = buildPrompt(body)); }
  catch (e) { return new Response(JSON.stringify({ error: e.error || 'Bad request.' }), { status: e.status || 400, headers: { 'Content-Type': 'application/json' } }); }

  // DeepSeek-chat is the general-purpose model; use deepseek-reasoner for chain-of-thought
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  let dsRes;
  try {
    dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
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

  if (!dsRes.ok || !dsRes.body) {
    let detail = '';
    try { detail = await dsRes.text(); } catch {}
    console.error('DeepSeek API error:', dsRes.status, detail);
    const isQuota = dsRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'DeepSeek rate limit reached. Please wait a moment and try again.'
        : 'Failed to reach the DeepSeek AI service.',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  // Same OpenAI-compatible SSE format
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader  = dsRes.body.getReader();

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
        console.error('DeepSeek stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
