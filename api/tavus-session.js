export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, conversation_id } = req.body;
  const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

  if (action === 'end') {
    try {
      await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/end`, {
        method: 'POST',
        headers: { 'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json' }
      });
    } catch(e) {}
    return res.json({ ok: true });
  }

  if (action === 'create') {
    if (!TAVUS_API_KEY) {
      return res.status(500).json({ error: 'Missing TAVUS_API_KEY env var' });
    }

    try {
      const resp = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: { 'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replica_id: 'r4dcf31b60e1',
          persona_id: 'p5e7734454f9',
          conversation_name: 'Emily BD Session',
          properties: { max_call_duration: 300 }
        })
      });
      const data = await resp.json();
      if (!resp.ok) return res.status(resp.status).json({ error: data.message || 'Tavus API error' });
      return res.json({
        conversation_id: data.conversation_id,
        conversation_url: data.conversation_url
      });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to create Tavus session: ' + err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
