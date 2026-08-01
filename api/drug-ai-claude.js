// api/drug-ai-claude.js — Anthropic Claude provider
// Same interface as drug-ai-details.js (Gemini). Streams plain text back.
// Requires ANTHROPIC_API_KEY in Vercel environment variables.
//
// Runs on the Node.js runtime rather than Edge. Vercel's Edge Runtime must
// send the first byte of a response within 25 seconds or the connection is
// cut, regardless of what the upstream model is still doing. For a detailed
// prompt (e.g. "list every drug in this class"), Claude's time-to-first-byte
// can exceed that, which showed up as a silently empty stream ("connection
// closed before the response completed") even though nothing was actually
// wrong with the API key or the request. Node.js functions only enforce an
// overall duration limit, not a first-byte deadline, so they tolerate a
// slower-starting stream. maxDuration below requests up to 60s (Hobby plan
// ceiling); raise it if the Vercel project is on Pro.

export const config = { runtime: 'nodejs' };
export const maxDuration = 60;

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
      let wroteAny = false;
      let streamErrorMsg = '';
      let stopReason = '';
      let sawMessageStop = false;
      const blockTypesSeen = new Set();
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
              // Anthropic can send a mid-stream error event (rate limit,
              // overload, etc.) after already returning 200 OK. Previously
              // this was silently ignored, so the client just saw a blank
              // stream with no explanation ("AI returned an empty
              // response"). Surface the real reason as visible text instead.
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
        // Nothing was written to the client. Figure out and report why,
        // rather than letting the client fall back to a generic "empty
        // response" message with no diagnostic value.
        if (!wroteAny) {
          if (streamErrorMsg) {
            controller.enqueue(encoder.encode(`[Claude error: ${streamErrorMsg}]`));
          } else if (!sawMessageStop) {
            controller.enqueue(encoder.encode('[Claude error: connection closed before the response completed. This usually means the request was cut off by the platform (e.g. an edge function timeout) rather than Claude itself.]'));
          } else if (stopReason === 'max_tokens') {
            controller.enqueue(encoder.encode('[Claude error: hit the token limit before producing any output text. Try again — if this repeats, the request may need a smaller/simpler prompt.]'));
          } else if (blockTypesSeen.size && !blockTypesSeen.has('text')) {
            controller.enqueue(encoder.encode(`[Claude error: response contained only ${[...blockTypesSeen].join(', ')} content, no text output.]`));
          } else if (stopReason) {
            controller.enqueue(encoder.encode(`[Claude error: stopped with reason "${stopReason}" and produced no text.]`));
          } else {
            controller.enqueue(encoder.encode('[Claude error: received a response with no text content and no stated reason. Please try again.]'));
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
