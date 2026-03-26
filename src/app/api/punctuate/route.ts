import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text, language } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ message: "Missing Gemini API key" }, { status: 500 });
  }

  const prompt = `Rewrite the following ${language || "Korean"} text with correct punctuation and sentence boundaries. Do not remove, summarize, or skip any part. Only return the full improved text, preserving all content.\n\n${text}`;

  const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", errorText);
    return NextResponse.json({ message: "Gemini error", error: errorText }, { status: 500 });
  }

  const data = await response.json();
  // Gemini returns improved text in data.candidates[0].content.parts[0].text
  const improved = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  return NextResponse.json({ improved });
}
