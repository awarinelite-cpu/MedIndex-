// api/drug-ai-claude.js — Anthropic Claude provider
// Same interface as drug-ai-details.js (Gemini). Streams plain text back.
// Requires ANTHROPIC_API_KEY in Vercel environment variables.
//
// The Response object (and its ReadableStream) is returned to the client
// BEFORE the fetch to Anthropic is even made. Previously the function
// awaited the full Anthropic fetch (and validated it) before returning
// anything at all — so if Claude took a while, or the platform enforces any
// kind of "must begin responding quickly" rule, the client could end up with
// nothing delivered at all: no content, no error, request just vanishes,
// even though Anthropic fully generated (and billed for) a response. Now a
// harmless placeholder byte goes out the instant the stream opens, and the
// Anthropic call + all its error handling happens inside the stream itself,
// so there's no way for the client to be left with literally nothing.

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
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Sent immediately, before any network call — guarantees the client
      // sees the response as having started right away, regardless of how
      // long Claude itself takes. Stripped by the client's .trim() calls.
      controller.enqueue(encoder.encode(' '));

      let wroteAny = false;
      let streamErrorMsg = '';
      let stopReason = '';
      let sawMessageStop = false;
      const blockTypesSeen = new Set();

      try {
        let claudeRes;
        try {
          claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type':      'application/json',
              'x-api-key':         apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              stream:     true,
              messages:   [{ role: 'user', content: prompt }],
            }),
          });
        } catch (fetchErr) {
          console.error('Claude fetch error:', fetchErr);
          controller.enqueue(encoder.encode('[Claude error: could not reach the Anthropic API. Check network/DNS from the server.]'));
          return;
        }

        if (!claudeRes.ok || !claudeRes.body) {
          let detail = '';
          try { detail = await claudeRes.text(); } catch {}
          console.error('Claude API error:', claudeRes.status, detail);
          let msg = `Claude API error (${claudeRes.status}).`;
          if (claudeRes.status === 429) msg = 'Claude API rate limit reached. Please wait a moment and try again.';
          else if (claudeRes.status === 401) msg = 'Claude API key was rejected (invalid or revoked).';
          else if (claudeRes.status === 400) msg = `Claude API rejected the request: ${detail.slice(0, 200)}`;
          controller.enqueue(encoder.encode(`[Claude error: ${msg}]`));
          return;
        }

        const reader = claudeRes.body.getReader();
        let buffer = '';
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
              if (eventType === 'error') {
                streamErrorMsg = evt?.error?.message || 'The AI service reported an error mid-response.';
                continue;
              }
              if (eventType === 'content_block_start' && evt.content_block?.type) {
                blockTypesSeen.add(evt.content_block.type);
              }
              if (eventType === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(evt.delta.text));
                wroteAny = true;
              }
              if (eventType === 'message_delta' && evt.delta?.stop_reason) {
                stopReason = evt.delta.stop_reason;
              }
              if (eventType === 'message_stop') {
                sawMessageStop = true;
              }
            } catch {}
          }
        }

        if (!wroteAny) {
          if (streamErrorMsg) {
            controller.enqueue(encoder.encode(`[Claude error: ${streamErrorMsg}]`));
          } else if (!sawMessageStop) {
            controller.enqueue(encoder.encode('[Claude error: connection to Anthropic closed before the response completed.]'));
          } else if (stopReason === 'max_tokens') {
            controller.enqueue(encoder.encode('[Claude error: hit the token limit before producing any output text.]'));
          } else if (blockTypesSeen.size && !blockTypesSeen.has('text')) {
            controller.enqueue(encoder.encode(`[Claude error: response contained only ${[...blockTypesSeen].join(', ')} content, no text output.]`));
          } else if (stopReason) {
            controller.enqueue(encoder.encode(`[Claude error: stopped with reason "${stopReason}" and produced no text.]`));
          } else {
            controller.enqueue(encoder.encode('[Claude error: received a response with no text content and no stated reason.]'));
          }
        }
      } catch (err) {
        console.error('Claude stream error:', err);
        if (!wroteAny) controller.enqueue(encoder.encode('[Claude error: connection interrupted before any content arrived.]'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
