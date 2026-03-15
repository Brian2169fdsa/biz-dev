export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { tool_name, parameters } = req.body;
  const N8N = 'https://manageai2026.app.n8n.cloud/webhook';
  const SB = 'https://palcqjfgygpidzwjzikn.supabase.co/rest/v1';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbGNxamZneWdwaWR6d2p6aWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4MTUzNywiZXhwIjoyMDg4MzU3NTM3fQ.ojp5xMRnHy_GQ8ImmFG-PMlYcYw78kh7Cftp26u3CsA';
  const sbHeaders = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

  try {
    if (tool_name === 'hunt_investors') {
      const r = await fetch(`${N8N}/manage-bd-investor`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target_type:'investor', investor_type: parameters.investor_type||'venture capital', stage: parameters.stage||'Series A', sector: parameters.sector||'AI automation', geography: parameters.geography||'US', submitter_name:'Dave', submitter_email:'dave@manageai.io' }) });
      return res.json({ result: `Investor hunt started. Looking for ${parameters.investor_type||'VC'} firms at ${parameters.stage||'Series A'} stage. I'll have prospects back in about 90 seconds.` });
    }
    if (tool_name === 'hunt_clients') {
      const r = await fetch(`${N8N}/manage-bd-client`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target_type:'client', vertical: parameters.vertical||'behavioral_health', city: parameters.city||'Phoenix', state: parameters.state||'AZ', max_results: parameters.max_results||25, submitter_name:'Dave', submitter_email:'dave@manageai.io' }) });
      return res.json({ result: `Client hunt fired for ${parameters.vertical||'behavioral health'} in ${parameters.city||'Phoenix'}, ${parameters.state||'AZ'}. Expect 20-30 enriched contacts in about 60 seconds.` });
    }
    if (tool_name === 'hunt_talent') {
      const r = await fetch(`${N8N}/manage-bd-talent`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target_type:'talent', hunt_type: parameters.hunt_type||'talent', role: parameters.role, location: parameters.location||'Phoenix AZ', level: parameters.level||'senior', skills: parameters.skills, submitter_name:'Dave', submitter_email:'dave@manageai.io' }) });
      return res.json({ result: `Talent hunt running for ${parameters.role||'automation engineers'} in ${parameters.location||'Phoenix'}. Results in about 90 seconds.` });
    }
    if (tool_name === 'get_pipeline_briefing') {
      const contacts = await fetch(`${SB}/eb_contacts?select=target_type,fit_score,tier,status,created_at&limit=500`, { headers: sbHeaders }).then(r=>r.json()).catch(()=>[]);
      const outreach = await fetch(`${SB}/eb_outreach?select=id,responded,status&limit=100`, { headers: sbHeaders }).then(r=>r.json()).catch(()=>[]);
      const total = contacts.length;
      const priority = contacts.filter(c=>c.tier==='priority').length;
      const qualified = contacts.filter(c=>c.tier==='qualified').length;
      const avgScore = total ? Math.round(contacts.filter(c=>c.fit_score).reduce((s,c)=>s+c.fit_score,0)/contacts.filter(c=>c.fit_score).length) : 0;
      const sent = outreach.filter(o=>o.status==='sent').length;
      const responded = outreach.filter(o=>o.responded).length;
      const fiveDaysAgo = new Date(Date.now()-5*86400000).toISOString();
      const stale = contacts.filter(c=>c.created_at<fiveDaysAgo&&c.status==='new').length;
      return res.json({ result: `Pipeline snapshot: ${total} total contacts. ${priority} priority, ${qualified} qualified. Average fit score ${avgScore}. Outreach: ${sent} sent, ${responded} responded. ${stale} contacts stale over 5 days — those need attention, Dave.` });
    }
    if (tool_name === 'get_top_targets') {
      const tier = parameters.tier || 'priority';
      const contacts = await fetch(`${SB}/eb_contacts?tier=eq.${tier}&select=name,title,company_name,fit_score,email,target_type&order=fit_score.desc&limit=5`, { headers: sbHeaders }).then(r=>r.json()).catch(()=>[]);
      if (!contacts.length) return res.json({ result: `No ${tier} contacts in the pipeline yet. Run a hunt first.` });
      const list = contacts.map((c,i)=>`${i+1}. ${c.name||'Unknown'} — ${c.title||''} at ${c.company_name||''}, fit score ${c.fit_score||'—'}`).join('. ');
      return res.json({ result: `Top ${tier} targets: ${list}` });
    }
    return res.json({ result: 'Got it, Dave. What else do you need?' });
  } catch(err) {
    console.error('emily-action error:', err);
    return res.status(500).json({ result: 'Action failed: ' + err.message });
  }
}
