// api/emily-action.js
// Handles all Tavus tool_call events for Emily BD
// Called by the Daily app-message listener in index.html

const N8N = 'https://manageai2026.app.n8n.cloud/webhook';
const SB_URL = 'https://palcqjfgygpidzwjzikn.supabase.co/rest/v1';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbGNxamZneWdwaWR6d2p6aWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4MTUzNywiZXhwIjoyMDg4MzU3NTM3fQ.ojp5xMRnHy_GQ8ImmFG-PMlYcYw78kh7Cftp26u3CsA';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ||
  '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';
const PIPEDRIVE_KEY = process.env.PIPEDRIVE_API_KEY || '2fada79568e20083cf472cd5b307e9e12d171a1d';

const sbHeaders = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function sbGet(path) {
  const r = await fetch(`${SB_URL}/${path}`, { headers: sbHeaders });
  if (!r.ok) return [];
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(`${SB_URL}/${path}`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify(body)
  });
  if (!r.ok) return null;
  return r.json();
}

async function n8nPost(webhook, body) {
  const r = await fetch(`${N8N}/${webhook}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.ok;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Poll Helper ─────────────────────────────────────────────────────────────

async function pollForResults(mode, fallbackMsg) {
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const queue = await sbGet('eb_queue?order=created_at.desc&limit=1');
    const run = queue[0];
    if (run && (run.status === 'complete' || run.status === 'failed')) {
      if (run.status === 'complete' && run.contacts_found > 0) {
        const topContacts = await sbGet(
          `eb_contacts?queue_id=eq.${run.id}&select=name,title,company_name,fit_score,tier,email&order=fit_score.desc&limit=5`
        );
        const names = topContacts.slice(0, 3)
          .map(c => `${c.name} at ${c.company_name}, score ${c.fit_score}`)
          .join('; ');
        return `Hunt complete, Dave. Found ${run.contacts_found} contacts. Top results: ${names}. All scored and in the pipeline — check the Outputs tab for the full list.`;
      }
      if (run.status === 'failed') {
        return `Hunt failed, Dave. Check n8n — the workflow may need attention.`;
      }
      return `${mode} hunt complete, Dave. ${run.contacts_found || 0} contacts added.`;
    }
  }
  return fallbackMsg;
}

// ── Tool Handlers ────────────────────────────────────────────────────────────

// TOOL 1: hunt_investors
// Fires manage-bd-investor webhook, logs to eb_queue
async function huntInvestors(params) {
  const {
    investor_type = 'venture capital',
    stage = 'Series A',
    sector = 'AI automation enterprise software',
    geography = 'United States',
    check_size = '$1M-$5M'
  } = params;

  const fired = await n8nPost('manage-bd-investor', {
    target_type: 'investor',
    investor_type,
    stage,
    sector,
    geography,
    check_size,
    submitter_name: 'Dave Albertson',
    submitter_email: 'dave@manageai.io',
    source: 'emily_video'
  });

  if (!fired) {
    return `The investor hunt webhook failed to fire, Dave. Check n8n — manage-bd-investor may need to be activated.`;
  }

  return pollForResults('investor',
    `Investor hunt is still running, Dave. ${investor_type} firms at ${stage} stage. Check the Outputs tab in about 60 seconds for the full results.`
  );
}

// TOOL 2: hunt_clients
// Fires manage-bd-client webhook
async function huntClients(params) {
  const {
    vertical = 'behavioral_health',
    city = 'Phoenix',
    state = 'AZ',
    max_results = 25
  } = params;

  const fired = await n8nPost('manage-bd-client', {
    target_type: 'client',
    vertical,
    city,
    state,
    max_results: Math.min(parseInt(max_results) || 25, 50),
    submitter_name: 'Dave Albertson',
    submitter_email: 'dave@manageai.io',
    source: 'emily_video'
  });

  if (!fired) {
    return `Client hunt webhook failed, Dave. Check n8n — manage-bd-client needs to be active.`;
  }

  const vertLabel = vertical.replace(/_/g, ' ');
  return pollForResults('client',
    `Client hunt is still running, Dave. ${vertLabel} companies in ${city}, ${state}. Check the Outputs tab in about 60 seconds for the full results.`
  );
}

// TOOL 3: hunt_talent
// Fires manage-bd-talent webhook
async function huntTalent(params) {
  const {
    hunt_type = 'talent',
    role = 'automation engineer',
    location = 'Phoenix AZ',
    level = 'senior',
    skills = 'n8n, Make.com, AI agents'
  } = params;

  const fired = await n8nPost('manage-bd-talent', {
    target_type: hunt_type === 'partner' ? 'partner' : 'talent',
    hunt_type,
    role,
    location,
    level,
    skills,
    submitter_name: 'Dave Albertson',
    submitter_email: 'dave@manageai.io',
    source: 'emily_video'
  });

  if (!fired) {
    return `Talent hunt webhook failed. Check n8n — manage-bd-talent needs to be active.`;
  }

  const label = hunt_type === 'partner' ? 'partner' : 'talent';
  return pollForResults(label,
    `${hunt_type === 'partner' ? 'Partner' : 'Talent'} hunt is still running, Dave. ${role} in ${location}. Check the Outputs tab in about 60 seconds for the full results.`
  );
}

// TOOL 4: get_pipeline_briefing
// Reads eb_contacts, eb_outreach, eb_queue, eb_briefings
async function getPipelineBriefing() {
  const [contacts, outreach, queue, briefings] = await Promise.all([
    sbGet('eb_contacts?select=name,company_name,target_type,fit_score,tier,status,created_at,outreach_angle&limit=500'),
    sbGet('eb_outreach?select=id,channel,to_email,status,responded,sent_at&limit=200'),
    sbGet('eb_queue?select=mode,target_type,status,contacts_found,created_at&order=created_at.desc&limit=10'),
    sbGet('eb_briefings?select=body,created_at&order=created_at.desc&limit=1')
  ]);

  const total = contacts.length;

  if (total === 0) {
    return `Dave, the pipeline is empty right now. No contacts in the system yet. Fire a client hunt or investor hunt to start building inventory. I would start with behavioral health in Phoenix — that is your strongest vertical.`;
  }

  // Tier breakdown
  const priority = contacts.filter(c => c.tier === 'priority').length;
  const qualified = contacts.filter(c => c.tier === 'qualified').length;
  const developing = contacts.filter(c => c.tier === 'developing').length;

  // Fit score
  const scored = contacts.filter(c => c.fit_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, c) => s + c.fit_score, 0) / scored.length)
    : 0;

  // Outreach
  const sent = outreach.filter(o => o.status === 'sent' || o.status === 'delivered').length;
  const responded = outreach.filter(o => o.responded === true).length;
  const replyRate = sent > 0 ? Math.round((responded / sent) * 100) : 0;

  // Stale contacts — new status, created more than 5 days ago
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
  const stale = contacts.filter(c => c.status === 'new' && c.created_at < fiveDaysAgo).length;

  // Type breakdown
  const byType = {};
  contacts.forEach(c => {
    byType[c.target_type] = (byType[c.target_type] || 0) + 1;
  });
  const typeBreakdown = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  // Top priority contact
  const topContact = contacts
    .filter(c => c.fit_score != null)
    .sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0))[0];

  // Recent run
  const lastRun = queue[0];

  let briefing = `Dave. Here is where things stand.\n\n`;
  briefing += `Pipeline: ${total} total contacts — ${priority} priority, ${qualified} qualified, ${developing} developing. Type breakdown: ${typeBreakdown}. Average fit score ${avgScore}.\n\n`;

  if (sent > 0) {
    briefing += `Outreach: ${sent} emails sent, ${responded} responses, ${replyRate}% reply rate.\n\n`;
  } else {
    briefing += `Outreach: nothing sent yet.\n\n`;
  }

  if (stale > 0) {
    briefing += `${stale} contacts sitting untouched for 5-plus days — that needs attention.\n\n`;
  }

  if (topContact) {
    briefing += `Top contact right now: ${topContact.name || 'Unknown'} at ${topContact.company_name || '—'}, fit score ${topContact.fit_score}. `;
    if (topContact.outreach_angle) briefing += `Outreach angle: ${topContact.outreach_angle}.\n\n`;
  }

  if (lastRun) {
    briefing += `Last hunt: ${lastRun.mode || lastRun.target_type} — ${lastRun.status}, ${lastRun.contacts_found || 0} contacts found, ${timeAgo(lastRun.created_at)}.`;
  }

  return briefing;
}

// TOOL 5: get_top_targets
// Returns ranked contacts from eb_contacts
async function getTopTargets(params) {
  const {
    tier = 'priority',
    limit = 5,
    target_type = 'all'
  } = params;

  let query = `eb_contacts?select=name,title,company_name,target_type,fit_score,tier,outreach_angle,email,status&order=fit_score.desc&limit=${Math.min(parseInt(limit) || 5, 10)}`;

  if (tier !== 'all') {
    query += `&tier=eq.${tier}`;
  }
  if (target_type !== 'all') {
    query += `&target_type=eq.${target_type}`;
  }

  const contacts = await sbGet(query);

  if (!contacts.length) {
    if (tier === 'priority') {
      return `No priority contacts in the pipeline yet, Dave. Priority requires a fit score of 80 or above. Run a hunt and I will score everything — should have priority-tier contacts within a few minutes.`;
    }
    return `No contacts match that filter. The pipeline may still be empty or building. Try "all" to see everything.`;
  }

  const lines = contacts.map((c, i) => {
    const name = c.name || 'Unknown';
    const co = c.company_name || '—';
    const title = c.title || '—';
    const score = c.fit_score != null ? c.fit_score : '—';
    const email = c.email ? '✓ email' : 'no email';
    const angle = c.outreach_angle ? ` — ${c.outreach_angle}` : '';
    return `${i + 1}. ${name}, ${title} at ${co}. Fit score ${score}, ${email}.${angle}`;
  });

  const tierLabel = tier === 'all' ? 'Top contacts' : `Top ${tier} contacts`;
  return `${tierLabel}, Dave:\n\n${lines.join('\n\n')}`;
}

// TOOL 6: send_outreach
// Finds contact in eb_contacts, fires manage-bd-email, logs to eb_outreach
async function sendOutreach(params) {
  const { contact_name, company_name, outreach_angle } = params;

  if (!contact_name) {
    return `I need a contact name to send outreach, Dave. Who should I reach out to?`;
  }

  // Find contact in Supabase
  const searchName = encodeURIComponent(contact_name);
  let contacts = await sbGet(`eb_contacts?name=ilike.*${searchName}*&limit=3`);

  // Fallback: search by company if name not found
  if (!contacts.length && company_name) {
    const searchCo = encodeURIComponent(company_name);
    contacts = await sbGet(`eb_contacts?company_name=ilike.*${searchCo}*&limit=3`);
  }

  const contact = contacts[0];

  if (!contact) {
    return `I could not find ${contact_name} in the pipeline, Dave. They may not be enriched yet. Run a hunt first or I can draft a cold email if you give me their email address.`;
  }

  if (!contact.email) {
    return `Found ${contact.name} at ${contact.company_name} but no email on file. Hunter and Apollo did not surface one. Want me to try a manual lookup or reach out on LinkedIn instead?`;
  }

  // If no angle passed, use scored angle from pipeline
  const angle = outreach_angle || contact.outreach_angle || 'AI workforce automation for operational efficiency';

  // Fire manage-bd-email webhook
  const fired = await n8nPost('manage-bd-email', {
    contact_id: contact.id,
    name: contact.name,
    first_name: contact.first_name || contact.name.split(' ')[0],
    last_name: contact.last_name || contact.name.split(' ').slice(1).join(' '),
    title: contact.title,
    company_name: contact.company_name,
    email: contact.email,
    target_type: contact.target_type,
    fit_score: contact.fit_score,
    outreach_angle: angle,
    source: 'emily_video'
  });

  if (!fired) {
    return `Email webhook failed, Dave. Check n8n — manage-bd-email needs to be active. The contact is in the pipeline at ${contact.email}.`;
  }

  return `Email drafted and sent to ${contact.name} at ${contact.email}. Angle: ${angle}. I will flag you when there is a response. The send is logged in the Outreach tab.`;
}

// TOOL 7: push_to_crm
// Finds contact, fires manage-bd-crm, logs Pipedrive deal
async function pushToCrm(params) {
  const { contact_name, company_name, deal_stage = 'prospecting' } = params;

  if (!contact_name || !company_name) {
    return `I need both a contact name and company name to create a Pipedrive deal, Dave.`;
  }

  // Find contact in Supabase
  const searchName = encodeURIComponent(contact_name);
  let contacts = await sbGet(`eb_contacts?name=ilike.*${searchName}*&limit=3`);

  if (!contacts.length) {
    const searchCo = encodeURIComponent(company_name);
    contacts = await sbGet(`eb_contacts?company_name=ilike.*${searchCo}*&limit=3`);
  }

  const contact = contacts[0];

  if (!contact) {
    return `Could not find ${contact_name} at ${company_name} in the pipeline, Dave. They need to be enriched first — run a hunt or add them manually.`;
  }

  // Fire manage-bd-crm webhook
  const fired = await n8nPost('manage-bd-crm', {
    contact_id: contact.id,
    name: contact.name,
    title: contact.title,
    company_name: contact.company_name,
    email: contact.email || '',
    phone: contact.phone || '',
    target_type: contact.target_type,
    fit_score: contact.fit_score,
    tier: contact.tier,
    deal_stage,
    source: 'emily_video'
  });

  if (!fired) {
    return `CRM webhook failed, Dave. Check n8n — manage-bd-crm needs to be active.`;
  }

  return `${contact.name} at ${contact.company_name} is now in Pipedrive — deal created at ${deal_stage} stage. Fit score ${contact.fit_score || '—'}, ${contact.tier || '—'} tier. You will see it in your pipeline within 30 seconds.`;
}

// TOOL 8: get_stale_contacts
// Returns contacts with status='new' and created_at older than 5 days
async function getStaleContacts() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
  const contacts = await sbGet(
    `eb_contacts?status=eq.new&created_at=lt.${fiveDaysAgo}&select=name,title,company_name,target_type,fit_score,email,created_at&order=created_at.asc&limit=10`
  );
  if (!contacts.length) return `No stale contacts, Dave. Everything in the pipeline has been touched recently.`;
  const lines = contacts.map((c, i) => {
    const days = Math.floor((Date.now() - new Date(c.created_at)) / 86400000);
    return `${i+1}. ${c.name||'Unknown'} at ${c.company_name||'—'} — ${days} days untouched, fit score ${c.fit_score||'unscored'}`;
  });
  return `${contacts.length} contacts sitting untouched, Dave:\n\n${lines.join('\n')}\n\nWant me to draft outreach for the top ones?`;
}

// TOOL 9: search_contacts
// Search eb_contacts by name or company
async function searchContacts(params) {
  const { query } = params;
  if (!query) return `What are you searching for, Dave?`;
  const q = encodeURIComponent(query);
  const byName = await sbGet(`eb_contacts?name=ilike.*${q}*&select=name,title,company_name,target_type,fit_score,tier,email,status&limit=5`);
  const byCo = await sbGet(`eb_contacts?company_name=ilike.*${q}*&select=name,title,company_name,target_type,fit_score,tier,email,status&limit=5`);
  const merged = [...byName];
  byCo.forEach(c => { if (!merged.find(m => m.name === c.name)) merged.push(c); });
  if (!merged.length) return `Nothing found for "${query}" in the pipeline, Dave. They may not be enriched yet.`;
  const lines = merged.slice(0,5).map(c =>
    `${c.name||'Unknown'} — ${c.title||'—'} at ${c.company_name||'—'}. Tier: ${c.tier||'unscored'}, fit score ${c.fit_score||'—'}. Email: ${c.email ? '✓' : 'missing'}`
  );
  return `Found ${merged.length} match${merged.length===1?'':'es'} for "${query}":\n\n${lines.join('\n')}`;
}

// TOOL 10: get_pipedrive_deals
// Reads open deals from Pipedrive API
async function getPipedriveDeals(params) {
  const { stage } = params || {};
  try {
    const r = await fetch(`https://api.pipedrive.com/v1/deals?status=open&limit=20&api_token=${PIPEDRIVE_KEY}`);
    const data = await r.json();
    const deals = data.data || [];
    if (!deals.length) return `No open deals in Pipedrive right now, Dave.`;
    const lines = deals.slice(0,8).map((d,i) =>
      `${i+1}. ${d.title} — Stage: ${d.stage_id}, Value: ${d.value||'—'}, Added: ${new Date(d.add_time).toLocaleDateString()}`
    );
    return `${deals.length} open deals in Pipedrive:\n\n${lines.join('\n')}`;
  } catch(e) {
    return `Could not reach Pipedrive, Dave. Check the API key.`;
  }
}

// TOOL 11: identify_quick_wins
// Contacts with high fit score, have email, status=new, created in last 14 days
async function identifyQuickWins() {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const contacts = await sbGet(
    `eb_contacts?status=eq.new&created_at=gte.${twoWeeksAgo}&select=name,title,company_name,target_type,fit_score,tier,email,outreach_angle&order=fit_score.desc&limit=5`
  );
  const withEmail = contacts.filter(c => c.email && c.fit_score >= 60);
  if (!withEmail.length) return `No clear quick wins right now, Dave. Need more high-scoring contacts with emails. Run a hunt.`;
  const lines = withEmail.map((c,i) =>
    `${i+1}. ${c.name||'Unknown'} at ${c.company_name||'—'} — fit score ${c.fit_score}, has email. Angle: ${c.outreach_angle||'general AI automation pitch'}`
  );
  return `Your quick wins — high score, have email, fresh in the pipeline:\n\n${lines.join('\n')}\n\nWant me to send outreach to all of them?`;
}

// TOOL 12: recommend_next_action
// Analyzes pipeline state and recommends one clear action
async function recommendNextAction() {
  const [contacts, outreach, queue] = await Promise.all([
    sbGet('eb_contacts?select=name,company_name,target_type,fit_score,tier,status,email,created_at&limit=500'),
    sbGet('eb_outreach?select=id,status,responded,sent_at&limit=100'),
    sbGet('eb_queue?select=mode,status,created_at&order=created_at.desc&limit=5')
  ]);
  const total = contacts.length;
  const priority = contacts.filter(c => c.tier === 'priority');
  const withEmailNoOutreach = contacts.filter(c => c.email && c.fit_score >= 60 && c.status === 'new');
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
  const stale = contacts.filter(c => c.status === 'new' && c.created_at < fiveDaysAgo);
  const sent = outreach.filter(o => o.status === 'sent').length;
  const responded = outreach.filter(o => o.responded).length;
  if (total === 0) return `Dave, the pipeline is empty. The single best next action: fire a behavioral health client hunt in Phoenix. That is your strongest vertical and fastest path to conversations.`;
  if (priority.length > 0 && withEmailNoOutreach.length > 0) return `Dave, you have ${priority.length} priority contact${priority.length===1?'':'s'} with emails and no outreach sent. That is the highest leverage move right now — send emails to those ${priority.length}. Want me to do it?`;
  if (stale.length > 5) return `Dave, ${stale.length} contacts are going cold. Best next action: send a batch of outreach before you lose these. I can draft and send to the top 5 right now.`;
  if (sent > 0 && responded === 0) return `Dave, you have ${sent} emails out with zero responses. Either the timing is off or the angle needs adjusting. Best move: run a fresh client hunt to build more inventory while we wait.`;
  if (total < 20) return `Pipeline is thin — only ${total} contacts. Best move: run another hunt. Which vertical do you want more of — investors, behavioral health, or construction?`;
  return `Pipeline looks solid, Dave. ${total} contacts, ${priority.length} priority tier. Best next action: review the priority contacts and tell me who to push into Pipedrive as active deals.`;
}

// TOOL 13: get_vertical_performance
// Breakdown of contacts by vertical with avg scores
async function getVerticalPerformance() {
  const contacts = await sbGet('eb_contacts?select=target_type,fit_score,tier,status,email&limit=500');
  if (!contacts.length) return `No contacts in the pipeline yet, Dave.`;
  const byType = {};
  contacts.forEach(c => {
    const key = c.target_type || 'unknown';
    if (!byType[key]) byType[key] = { count:0, scored:[], withEmail:0, priority:0 };
    byType[key].count++;
    if (c.fit_score != null) byType[key].scored.push(c.fit_score);
    if (c.email) byType[key].withEmail++;
    if (c.tier === 'priority') byType[key].priority++;
  });
  const lines = Object.entries(byType).sort((a,b)=>b[1].count-a[1].count).map(([type, data]) => {
    const avg = data.scored.length ? Math.round(data.scored.reduce((s,n)=>s+n,0)/data.scored.length) : '—';
    return `${type}: ${data.count} total, avg fit score ${avg}, ${data.withEmail} with email, ${data.priority} priority`;
  });
  return `Pipeline breakdown by type:\n\n${lines.join('\n')}`;
}

// TOOL 14: draft_follow_up
// Generates a follow-up email for a contact who hasn't responded
async function draftFollowUp(params) {
  const { contact_name, company_name } = params;
  if (!contact_name) return `Who should I follow up with, Dave?`;
  const q = encodeURIComponent(contact_name);
  const contacts = await sbGet(`eb_contacts?name=ilike.*${q}*&limit=1`);
  const contact = contacts[0];
  if (!contact) return `Could not find ${contact_name} in the pipeline.`;
  const outreach = await sbGet(`eb_outreach?contact_id=eq.${contact.id}&order=sent_at.desc&limit=1`);
  const lastEmail = outreach[0];
  const daysSince = lastEmail ? Math.floor((Date.now() - new Date(lastEmail.sent_at)) / 86400000) : null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'anthropic-version':'2023-06-01', 'x-api-key': ANTHROPIC_KEY },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Write a short follow-up email from Emily Chen, BD Executive at ManageAI, to ${contact.name}, ${contact.title||''} at ${contact.company_name||''}. ${daysSince ? `It has been ${daysSince} days since the first email.` : ''} ManageAI: Stop buying AI tools. Start building an AI workforce. 4x output, 30-60% time savings. Keep it 2-3 sentences. Soft CTA. No fluff. Return only JSON: {"subject":"...","body":"..."}`
      }]
    })
  });
  const data = await r.json();
  let draft = {};
  try { draft = JSON.parse(data.content?.[0]?.text || '{}'); } catch(e) {}
  if (!draft.body) return `Had trouble drafting the follow-up, Dave. Try asking me again.`;
  if (contact.email) {
    await n8nPost('manage-bd-email', {
      contact_id: contact.id,
      name: contact.name,
      first_name: (contact.first_name || contact.name.split(' ')[0]),
      email: contact.email,
      subject: draft.subject,
      body: draft.body,
      source: 'emily_followup'
    });
    return `Follow-up sent to ${contact.name} at ${contact.email}. Subject: "${draft.subject}". ${daysSince ? `That is ${daysSince} days after the first touch.` : ''}`;
  }
  return `Follow-up drafted for ${contact.name} but no email on file. Subject: "${draft.subject}" — Body: ${draft.body}`;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tool_name, parameters = {}, conversation_id } = req.body;

  console.log(`[emily-action] tool_name=${tool_name}`, JSON.stringify(parameters));

  try {
    let result;

    switch (tool_name) {
      case 'hunt_investors':
        result = await huntInvestors(parameters);
        break;

      case 'hunt_clients':
        result = await huntClients(parameters);
        break;

      case 'hunt_talent':
        result = await huntTalent(parameters);
        break;

      case 'get_pipeline_briefing':
        result = await getPipelineBriefing();
        break;

      case 'get_top_targets':
        result = await getTopTargets(parameters);
        break;

      case 'send_outreach':
        result = await sendOutreach(parameters);
        break;

      case 'push_to_crm':
        result = await pushToCrm(parameters);
        break;

      case 'get_stale_contacts':
        result = await getStaleContacts();
        break;

      case 'search_contacts':
        result = await searchContacts(parameters);
        break;

      case 'get_pipedrive_deals':
        result = await getPipedriveDeals(parameters);
        break;

      case 'identify_quick_wins':
        result = await identifyQuickWins();
        break;

      case 'recommend_next_action':
        result = await recommendNextAction();
        break;

      case 'get_vertical_performance':
        result = await getVerticalPerformance();
        break;

      case 'draft_follow_up':
        result = await draftFollowUp(parameters);
        break;

      default:
        console.warn(`[emily-action] Unknown tool: ${tool_name}`);
        result = `Got it, Dave. What else do you need?`;
    }

    return res.status(200).json({ result, tool_name });

  } catch (err) {
    console.error(`[emily-action] Error in ${tool_name}:`, err);
    return res.status(500).json({
      result: `Something went wrong on my end, Dave. ${err.message}. Check the logs.`,
      error: err.message,
      tool_name
    });
  }
}
