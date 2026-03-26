import { NextRequest, NextResponse } from 'next/server';

// Replace with your Gemini API key or use env variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { sentence } = await req.json();
    if (!sentence) {
      console.error('Missing sentence in request body');
      return NextResponse.json({ error: 'Missing sentence' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set on server' }, { status: 500 });
    }

    // Compose prompt for Gemini
    const prompt = `Hãy phân tích câu tiếng Hàn sau đây:\n"${sentence}"\nYêu cầu:\n1. Giải thích từ vựng: liệt kê từng từ và nghĩa tiếng Việt.\n2. Giải thích ngữ pháp: phân tích các cấu trúc ngữ pháp được sử dụng.\n3. Dịch nghĩa toàn câu sang tiếng Việt.\n4. (Nếu có thể) Đưa ra ví dụ tương tự.\nTrả lời dưới dạng JSON với các trường: vocabulary (array), grammar (string), meaning (string), examples (array, optional).`;

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiRes.ok) {
      const error = await geminiRes.text();
      console.error('Gemini API error:', error);
      return NextResponse.json({ error: 'Gemini API error', details: error }, { status: 500 });
    }

    const data = await geminiRes.json();
    // Gemini returns a text response, try to parse JSON from it
    let explanation;
    try {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.error('Gemini raw text response:', text);
      // If already an object, just return it
      if (typeof text === 'object') {
        explanation = text;
      } else {
        let cleanText = text.trim();
        // Remove code block markers if present
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json/, '').trim();
        }
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```/, '').trim();
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.replace(/```$/, '').trim();
        }
        try {
          explanation = JSON.parse(cleanText);
        } catch (e) {
          // Fallback: try to eval as JS object if it looks like JS but not strict JSON
          if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
            try {
              // eslint-disable-next-line no-eval
              explanation = eval('(' + cleanText + ')');
            } catch (ee) {
              throw ee;
            }
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse Gemini response:', data);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.error('Gemini raw text response:', text);
      return NextResponse.json({ error: 'Failed to parse Gemini response', details: { data, text } }, { status: 500 });
    }

    return NextResponse.json(explanation);
  } catch (err) {
    console.error('Internal server error:', err);
    return NextResponse.json({ error: 'Internal server error', details: String(err) }, { status: 500 });
  }
}
