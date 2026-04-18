export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, userPrompt, tools, toolName } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          ...tools,
        ],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const toolUse = data.content.find((b) => b.type === 'tool_use');
    if (!toolUse) {
      console.error('No tool_use in response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Pas de réponse structurée' });
    }

    return res.status(200).json(toolUse.input);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
