// api/drug-ai-claude.js — Anthropic Claude provider
// Same interface as drug-ai-details.js (Gemini). Streams plain text back.
// Requires ANTHROPIC_API_KEY in Vercel environment variables.
//
// NODE.JS SERVERLESS FUNCTION (classic req/res signature), NOT Edge.
// Matches the pattern already used elsewhere in this project (see
// api/admin/users.js) rather than the Fetch-API Request/Response style,
// which is an Edge-runtime convention and does not behave reliably as a
// classic Vercel Node function on a non-Next.js project — an earlier
// attempt at this mixed the two and produced a silent multi-minute hang
// with zero output and zero logs.
//
// Edge runtime was also tried and abandoned: Anthropic would fully
// generate (and bill for) a response, but the connection from Vercel's
// Edge platform to Anthropic kept closing before the stream completed,
// consistent with an enforced duration ceiling on Edge regardless of
// whether the client-facing response had already started. A plain Node.js
// function has a single, configurable duration limit (see vercel.json)
// instead of that Edge-specific behavior.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
    return;
  }

  let buildPrompt, resolveModel;
  try {
    ({ buildPrompt } = await import('./_lib/buildPrompt.js'));
    ({ resolveModel } = await import('./_lib/resolveModel.js'));
  } catch (e) {
    console.error('Failed to load buildPrompt:', e);
    res.status(500).json({ error: 'Server error loading prompt builder.' });
    return;
  }

  let prompt, maxTokens;
  try {
    ({ prompt, maxTokens } = buildPrompt(req.body || {}));
  } catch (e) {
    res.status(e.status || 400).json({ error: e.error || 'Bad request.' });
    return;
  }

  const model = await resolveModel({
    field: 'claudeModel',
    allowed: new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8']),
    envVar: 'CLAUDE_MODEL',
    fallback: 'claude-sonnet-4-6',
  });

  // Start the response immediately, before the Anthropic call, so the
  // client is guaranteed to receive *something* even in a worst-case
  // failure — never a silent void.
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.write(' '); // heartbeat byte, stripped by the client's .trim()
  if (res.flush) res.flush();

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
      res.write('[Claude error: could not reach the Anthropic API from the server.]');
      res.end();
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
      res.write(`[Claude error: ${msg}]`);
      res.end();
      return;
    }

    const reader  = claudeRes.body.getReader();
    const decoder = new TextDecoder();
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
            res.write(evt.delta.text);
            if (res.flush) res.flush();
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
        res.write(`[Claude error: ${streamErrorMsg}]`);
      } else if (!sawMessageStop) {
        res.write('[Claude error: connection to Anthropic closed before the response completed.]');
      } else if (stopReason === 'max_tokens') {
        res.write('[Claude error: hit the token limit before producing any output text.]');
      } else if (blockTypesSeen.size && !blockTypesSeen.has('text')) {
        res.write(`[Claude error: response contained only ${[...blockTypesSeen].join(', ')} content, no text output.]`);
      } else if (stopReason) {
        res.write(`[Claude error: stopped with reason "${stopReason}" and produced no text.]`);
      } else {
        res.write('[Claude error: received a response with no text content and no stated reason.]');
      }
    }
  } catch (err) {
    console.error('Claude stream error:', err);
    if (!wroteAny) res.write('[Claude error: connection interrupted before any content arrived.]');
  } finally {
    res.end();
  }
}
