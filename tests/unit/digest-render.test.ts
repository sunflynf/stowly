import { describe, expect, it } from "vitest";
import { renderDigestEmail, renderDigestPush, type RenderAlert } from "@/lib/alerts/render";

const alerts: RenderAlert[] = [
  { item_id: "1", name: "Dầu ăn <2L>", kind: "expired", severity: 3, days_left: -3, replace_after_months: null, location_path: "Nhà bếp › Kệ bếp", location_path_en: "Kitchen › Kitchen shelf" },
  { item_id: "2", name: "Pin AA", kind: "low_stock", severity: 2, days_left: null, replace_after_months: null, location_path: null, location_path_en: null },
  { item_id: "3", name: "Gối ngủ", kind: "replace_due", severity: 2, days_left: -31, replace_after_months: 18, location_path: null, location_path_en: null },
  { item_id: "4", name: "Laptop", kind: "warranty_ending", severity: 2, days_left: 14, replace_after_months: null, location_path: null, location_path_en: null },
];

describe("digest rendering", () => {
  it("renders Vietnamese email with labels and escaped names", () => {
    const email = renderDigestEmail({ locale: "vi", timeZone: "Asia/Ho_Chi_Minh", siteUrl: "https://stowly.test", alerts });
    expect(email.subject).toBe("Stowly: 4 mục cần xử lý");
    expect(email.html).toContain("Dầu ăn &lt;2L&gt;");
    expect(email.html).toContain("Quá hạn 3 ngày");
    expect(email.html).toContain("Dùng 19 tháng · nên thay");
    expect(email.html).toContain("https://stowly.test/items/1");
    expect(email.text).toContain("• Pin AA — Tồn kho thấp");
  });

  it("renders English with English location paths", () => {
    const email = renderDigestEmail({ locale: "en", timeZone: "UTC", siteUrl: "https://stowly.test", alerts });
    expect(email.subject).toBe("Stowly: 4 items need attention");
    expect(email.text).toContain("Kitchen › Kitchen shelf");
    expect(email.text).toContain("Warranty: 14 days left");
  });

  it("summarises push notifications", () => {
    const push = renderDigestPush({ locale: "vi", timeZone: "Asia/Ho_Chi_Minh", alerts });
    expect(push.title).toBe("4 món đồ cần chú ý");
    expect(push.body.split("\n")).toHaveLength(4);
    expect(push.body).toContain("và 1 mục khác");
  });
});
