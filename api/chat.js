/* ==========================================================
   MITRA — server side
   ==========================================================
   Keeps your API key OFF the website. The browser talks to
   this function; this function talks to the AI provider.
   Nobody can read the key by viewing page source.

   Runs on either engine — set the AI_PROVIDER env var:

     'gemini'     Google AI Studio. Free tier, no credit card,
                  no expiry. Best choice for the clinic.
     'anthropic'  Claude. Better quality, but pay-as-you-go
                  after the one-time trial credit runs out.

   Setup instructions are in README.md.
   ========================================================== */

const SYSTEM_PROMPT = `You are Mitra, the pet care assistant for Pokhara Pet Hospital Pvt. Ltd. in Pokhara, Nepal.

CLINIC FACTS (never invent anything beyond these):
- Address: Pokhara-14, Khasibazar, near Pokhara International Airport
- Phone: 9802859465 and 061-590375
- WhatsApp: 9802859465
- Email: Pokharapethospital@gmail.com
- Hours: open 24 hours, 7 days a week, including festivals
- Veterinarians: Dr. Sonia Gurung (M.V.Sc) and Dr. Manoj Poudel (B.V.Sc & A.H.)
- Services: consultation, treatment, surgery, vaccination and wellness, 24/7 emergency care

YOUR JOB
Take appointment bookings in conversation, and answer general questions about the clinic. You are the front desk, not the doctor.

HOW YOU SPEAK
- Warm and professional. Short replies — two or three sentences, rarely more.
- Plain English. Match Nepali or Hinglish if the visitor uses it.
- One question at a time. Never interrogate.
- Never use bullet lists or headings. This is a chat, not a document.

HARD RULES
- You do not diagnose, name conditions, suggest medicines, or give dosages. Ever. If asked, say the veterinarian will assess in person and offer to book the visit.
- If anything sounds urgent — bleeding, seizures, breathing trouble, poisoning, road accident, collapse, bloated abdomen, unable to urinate, snake bite, severe pain — stop collecting details and tell them to call 9802859465 right now. Booking can wait.
- Never promise a specific doctor, price, or exact appointment time. Say the clinic confirms it.
- If you do not know something, say so and give the phone number.
- Do not ask for an address, email, ID number, or payment details. Name and phone are all the clinic needs.

BOOKING
Collect, conversationally, in whatever order it comes up: reason for the visit, animal type, pet's name, preferred time, owner's name, phone number. Do not ask for anything you were already told.

OUTPUT FORMAT
Reply with a single JSON object and nothing else. No markdown, no backticks.

{
  "reply": "what you say to the visitor",
  "chips": ["up to 4 short suggested replies, or an empty array"],
  "booking": {
    "complete": false,
    "reason": "", "petType": "", "petName": "",
    "when": "", "name": "", "phone": ""
  }
}

Fill booking fields as you learn them. Set "complete" to true only once all six are filled — at that moment your "reply" should tell the visitor you are showing the summary to confirm.`;


/* ---------- Google Gemini (free tier) ---------- */

async function callGemini(messages, key) {

    // Gemini calls the assistant "model" rather than "assistant"
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': key
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents,
                generationConfig: {
                    // Newer Gemini models "think" before answering, and the
                    // thinking secretly counts against this budget. 700 was
                    // starving the visible reply mid-sentence.
                    maxOutputTokens: 4000,
                    temperature: 0.6,
                    // Forces valid JSON — no stray prose to clean up
                    responseMimeType: 'application/json'
                }
            })
        }
    );

    if (!res.ok) {
        throw new Error('Gemini ' + res.status + ': ' + await res.text());
    }

    const data = await res.json();

    const finish = data?.candidates?.[0]?.finishReason;
    if (finish && finish !== 'STOP') {
        console.error('Gemini stopped early, finishReason:', finish);
    }

    return (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('')
        .trim();
}


/* ---------- Anthropic Claude ---------- */

async function callAnthropic(messages, key) {

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages
        })
    });

    if (!res.ok) {
        throw new Error('Anthropic ' + res.status + ': ' + await res.text());
    }

    const data = await res.json();
    return (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
}


/* ---------- the endpoint ---------- */

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
    }

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const key = provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.GEMINI_API_KEY;

    if (!key) {
        console.error('Missing API key for provider:', provider);
        return res.status(500).json({ error: 'Assistant is not configured' });
    }

    try {
        const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];

        // Keep the request small and drop anything malformed
        const messages = incoming
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-20)
            .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

        if (!messages.length) {
            return res.status(400).json({ error: 'No messages' });
        }

        const raw = provider === 'anthropic'
            ? await callAnthropic(messages, key)
            : await callGemini(messages, key);

        if (!raw) throw new Error('Empty response from provider');

        // Strip code fences if the model added them anyway
        const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // The model's JSON was cut off or malformed. Never dump raw
            // code into the chat — extract the human sentence from the
            // wreckage. The "reply" field comes first, so it usually
            // survives truncation intact.
            let reply = '';
            const m = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (m) {
                try { reply = JSON.parse('"' + m[1] + '"'); }  // unescape \n etc.
                catch { reply = m[1]; }
            }
            parsed = {
                reply: reply ||
                    'Sorry, I lost my thread for a moment — could you say that once more?',
                chips: [],
                booking: { complete: false }
            };
        }

        // Belt and braces: a visitor must never see raw JSON as a reply
        if (typeof parsed.reply === 'string' && parsed.reply.trim().startsWith('{')) {
            parsed.reply = 'Sorry, I lost my thread for a moment — could you say that once more?';
        }

        return res.status(200).json({
            reply:   parsed.reply || '',
            chips:   Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : [],
            booking: parsed.booking || { complete: false }
        });

    } catch (err) {
        console.error('Mitra handler failed:', err.message);
        // The website falls back to its guided flow when it sees this
        return res.status(502).json({ error: 'Assistant unavailable' });
    }
}
