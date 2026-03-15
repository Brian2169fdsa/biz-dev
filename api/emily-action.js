// api/emily-action.js
// Handles all Tavus tool_call events for Emily BD
// Called by the Daily app-message listener in index.html

const N8N = 'https://manageai2026.app.n8n.cloud/webhook';
const SB_URL = 'https://palcqjfgygpidzwjzikn.supabase.co/rest/v1';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbGNxamZneWdwaWR6d2p6aWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4MTUzNywiZXhwIjoyMDg4MzU3NTM3fQ.ojp5xMRnHy_GQ8ImmFG-PMlYcYw78kh7Cftp26u3CsA';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ||
  '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';

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

  return `Investor hunt running — ${investor_type}, ${stage}, ${sector} focus, ${geography}. Check size target: ${check_size}. Partner contacts will be enriched and scored. Results in the pipeline in about 90 seconds.`;
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
  return `Client hunt running — ${vertLabel} companies in ${city}, ${state}. Up to ${max_results} results. Google Places → TinyFish enrichment → Claude scoring. Contacts with emails and fit scores in about 60 seconds.`;
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

  if (hunt_type === 'partner') {
    return `Partner hunt running — looking for ${role} firms in ${location}. TinyFish sourcing LinkedIn and partner directories. Results in about 90 seconds.`;
  }
  return `Talent hunt running — ${level} ${role} candidates in ${location}. Skills: ${skills}. Results in about 90 seconds.`;
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
