export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, conversation_id, user_name, persona } = req.body;
  const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
  const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID;

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
    if (!TAVUS_API_KEY || !TAVUS_REPLICA_ID) {
      return res.status(500).json({ error: 'Missing TAVUS_API_KEY or TAVUS_REPLICA_ID env vars' });
    }

    let conversational_context, custom_greeting, tools;

    if (persona === 'emily') {
      conversational_context = "You are Emily Chen, ManageAI's Senior BD Executive. You work directly for Dave Albertson. You are direct, credible, and action-oriented. You never say certainly or of course. You have full access to the BD pipeline and can hunt investors, clients, and talent, get briefings, and surface top targets. When Dave asks you to execute something, call the appropriate tool. Open the conversation by asking Dave what he wants to focus on today — investors, clients, or pipeline status.";
      custom_greeting = "Dave. Emily here. Pipeline is live and I am ready to work. What are we going after today — investors, new clients, or do you want a full briefing first?";
      tools = [
        { name: "hunt_investors", description: "Find VC, PE, or angel investors interested in AI automation. Parameters: investor_type (string), stage (string), sector (string), geography (string)" },
        { name: "hunt_clients", description: "Find SMB client prospects by vertical and geography. Parameters: vertical (string), city (string), state (string), max_results (number)" },
        { name: "hunt_talent", description: "Find candidates or strategic partners. Parameters: hunt_type (talent or partner), role (string), location (string), level (string), skills (string)" },
        { name: "get_pipeline_briefing", description: "Get a full summary of the current BD pipeline including contact counts, scores, outreach status, and stale leads." },
        { name: "get_top_targets", description: "Get the top ranked targets by tier. Parameters: tier (priority, qualified, or all)" }
      ];
    } else {
      conversational_context = "You are Rebecka, ManageAI's Lead Booster AI. You help qualify and engage website visitors.";
      custom_greeting = "Hi there! I'm Rebecka from ManageAI. How can I help you today?";
      tools = [];
    }

    try {
      const resp = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: { 'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replica_id: TAVUS_REPLICA_ID,
          conversational_context,
          custom_greeting,
          tools,
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
