import { describe, expect, it } from "vitest";
import { speechLang, voiceToQuery } from "@/lib/voice";

describe("voiceToQuery", () => {
  it.each([
    ["where's the drill?", "drill"],
    ["Where is my passport", "passport"],
    ["where did I put the HDMI cable", "hdmi cable"],
    ["find the camping gear please", "camping gear"],
    ["do we have AA batteries", "aa batteries"],
  ])("en: %s → %s", (said, query) => {
    expect(voiceToQuery(said, "en")).toBe(query);
  });

  it.each([
    ["cái khoan ở đâu", "khoan"],
    ["Hộ chiếu của tôi để ở đâu?", "hộ chiếu"],
    ["tìm giúp tôi dây sạc type-c", "dây sạc type-c"],
    ["áo khoác mùa đông đâu rồi", "áo khoác mùa đông"],
    ["pin AA ở chỗ nào nhỉ", "pin aa"],
  ])("vi: %s → %s", (said, query) => {
    expect(voiceToQuery(said, "vi")).toBe(query);
  });

  it("keeps words that only contain a filler (cáp is not cái, bàn is not an)", () => {
    expect(voiceToQuery("cáp lightning ở đâu", "vi")).toBe("cáp lightning");
    expect(voiceToQuery("where is the bandage", "en")).toBe("bandage");
  });

  it("falls back to what was said when it was all filler", () => {
    expect(voiceToQuery("where is it", "en")).toBe("it");
    expect(voiceToQuery("ở đâu", "vi")).toBe("ở đâu");
  });

  it("picks the recogniser language from the UI language", () => {
    expect(speechLang("vi")).toBe("vi-VN");
    expect(speechLang("en")).toBe("en-US");
  });
});
