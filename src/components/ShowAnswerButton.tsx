import React, { useState } from 'react';

interface GeminiExplanation {
  vocabulary: { word: string; meaning: string }[];
  grammar: string;
  meaning: string;
  examples?: string[];
}

export default function ShowAnswerButton({ sentence }: { sentence: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiExplanation | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/gemini-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Không parse được JSON từ API');
      }
      if (!res.ok) {
        // Nếu có details thì show luôn
        setError((data.error || 'API error') + (data.details ? ': ' + JSON.stringify(data.details) : ''));
        return;
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {loading ? 'Đang tải...' : 'Xem đáp án'}
      </button>
      {error && <div className="text-red-600 mt-2 whitespace-pre-wrap">Lỗi: {error}</div>}
      {result && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="font-bold mb-2">Giải thích từ vựng:</h3>
          <ul className="list-disc ml-6">
            {result.vocabulary.map((v, i) => (
              <li key={i}><b>{v.word}</b>: {v.meaning}</li>
            ))}
          </ul>
          {/* Bỏ phần ngữ pháp */}
          <h3 className="font-bold mt-4 mb-2">Nghĩa toàn câu:</h3>
          <div>{result.meaning}</div>
          {/* Bỏ phần ví dụ */}
        </div>
      )}
    </div>
  );
}
