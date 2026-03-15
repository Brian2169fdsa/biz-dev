export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    queue_id,
    mode,
    status,
    contacts_found,
    top_contacts,
    conversation_id
  } = req.body;

  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SB_URL = 'https://palcqjfgygpidzwjzikn.supabase.co/rest/v1';
  const sbH = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json'
  };

  // Update queue row status
  if (queue_id) {
    await fetch(`${SB_URL}/eb_queue?id=eq.${queue_id}`, {
      method: 'PATCH',
      headers: sbH,
      body: JSON.stringify({
        status,
        contacts_found: contacts_found || 0,
        updated_at: new Date().toISOString()
      })
    });
  }

  // Build Emily's spoken response
  let speech = '';
  if (status === 'complete' && contacts_found > 0) {
    const topList = (top_contacts || []).slice(0, 3)
      .map(c => `${c.name} at ${c.company_name}, fit score ${c.fit_score}`)
      .join(', ');
    speech = `Dave. ${mode} hunt complete. Found ${contacts_found} contacts. ` +
      (topList ? `Top results: ${topList}. ` : '') +
      `All scored and ready in the pipeline. Check the Outputs tab for the full list.`;
  } else if (status === 'failed') {
    speech = `Dave, the ${mode} hunt failed. Check n8n for the error. Want me to retry?`;
  } else {
    speech = `${mode} hunt complete, Dave. ${contacts_found || 0} contacts added to the pipeline.`;
  }

  // If Emily video is active, make her speak
  if (conversation_id && speech) {
    try {
      await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/say`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.TAVUS_API_KEY
        },
        body: JSON.stringify({ text: speech })
      });
    } catch(e) {
      console.error('Tavus speak error:', e);
    }
  }

  return res.status(200).json({ ok: true, speech });
}
