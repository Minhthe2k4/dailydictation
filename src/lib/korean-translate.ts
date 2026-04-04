const koreanVietnameseDictionary: Record<string, string> = {
  안녕하세요: "Xin chào",
  감사합니다: "Cảm ơn",
  미안합니다: "Xin lỗi",
  네: "Vâng / Có",
  아니요: "Không",
  공부: "Học tập",
  선생님: "Giáo viên",
  학교: "Trường học",
  친구: "Bạn",
  가족: "Gia đình",
  날씨: "Thời tiết",
  좋다: "Tốt",
  나쁘다: "Xấu",
  크다: "Lớn",
  작다: "Nhỏ",
  많다: "Nhiều",
  적다: "Ít",
  먹다: "Ăn",
  마시다: "Uống",
  자다: "Ngủ",
  공부하다: "Học",
  걷다: "Đi bộ",
  달리다: "Chạy",
  치다: "Đánh",
  듣다: "Nghe",
  본다: "Nhìn",
  말하다: "Nói",
  쓰다: "Viết",
  읽다: "Đọc",
  사람: "Người",
  오늘: "Hôm nay",
  내일: "Ngày mai",
  지금: "Bây giờ",
  여기: "Ở đây",
  저기: "Kia",
  뭐: "Cái gì",
  왜: "Tại sao",
  어디: "Ở đâu",
  언제: "Khi nào",
};

export function normalizeKoreanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function translateKoreanText(koreanText: string): string {
  const normalized = normalizeKoreanText(koreanText);
  if (!normalized) {
    return "";
  }

  let result = normalized;
  const sortedEntries = Object.entries(koreanVietnameseDictionary).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [korean, vietnamese] of sortedEntries) {
    const regex = new RegExp(korean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    result = result.replace(regex, `${vietnamese} (${korean})`);
  }

  if (result === normalized) {
    return `${normalized} [Chưa có bản dịch sẵn]`;
  }

  return result;
}

export function translateKoreanWord(word: string): string | null {
  const normalized = normalizeKoreanText(word);
  if (!normalized) {
    return null;
  }

  if (koreanVietnameseDictionary[normalized]) {
    return koreanVietnameseDictionary[normalized];
  }

  const stripped = normalized.replace(/["'”’.,!?;:()\[\]{}]+$/g, "");
  if (stripped !== normalized && koreanVietnameseDictionary[stripped]) {
    return koreanVietnameseDictionary[stripped];
  }

  return null;
}

export function lookupKoreanMeaning(text: string): string {
  const normalized = normalizeKoreanText(text);
  if (!normalized) {
    return "";
  }

  const word = translateKoreanWord(normalized);
  if (word) {
    return word;
  }

  return translateKoreanText(normalized);
}
