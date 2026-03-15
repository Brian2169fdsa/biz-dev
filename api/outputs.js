export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SB_URL = 'https://palcqjfgygpidzwjzikn.supabase.co/rest/v1';
  const sbH = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`
  };

  const [queue, contacts, outreach, briefings] = await Promise.all([
    fetch(`${SB_URL}/eb_queue?select=*&order=created_at.desc&limit=50`, { headers: sbH }).then(r=>r.json()).catch(()=>[]),
    fetch(`${SB_URL}/eb_contacts?select=*&order=created_at.desc&limit=200`, { headers: sbH }).then(r=>r.json()).catch(()=>[]),
    fetch(`${SB_URL}/eb_outreach?select=*&order=created_at.desc&limit=100`, { headers: sbH }).then(r=>r.json()).catch(()=>[]),
    fetch(`${SB_URL}/eb_briefings?select=*&order=created_at.desc&limit=10`, { headers: sbH }).then(r=>r.json()).catch(()=>[])
  ]);

  // Group contacts by queue_id for run-level grouping
  const contactsByQueue = {};
  contacts.forEach(c => {
    if (c.queue_id) {
      if (!contactsByQueue[c.queue_id]) contactsByQueue[c.queue_id] = [];
      contactsByQueue[c.queue_id].push(c);
    }
  });

  // Build runs output - each hunt run with its contacts
  const runs = queue.map(q => ({
    ...q,
    contacts: contactsByQueue[q.id] || []
  }));

  return res.status(200).json({
    runs,
    outreach,
    briefings,
    total_contacts: contacts.length
  });
}
