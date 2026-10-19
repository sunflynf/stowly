import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "@/lib/csv";
import { autoMap } from "@/lib/import/columns";
import { buildRow, normalizeDate } from "@/lib/import/rows";

describe("parseCsv", () => {
  it("handles BOM, quotes, escaped quotes, CRLF and newlines in cells", () => {
    const text = '﻿name,notes\r\n"Áo, khoác","dòng 1\ndòng ""2"""\r\nPin AA,\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Áo, khoác", 'dòng 1\ndòng "2"'],
      ["Pin AA", ""],
    ]);
  });
  it("detects semicolons (Excel, Vietnamese locale) and tabs", () => {
    expect(detectDelimiter("Tên;Số lượng;Ghi chú\nA;1;x")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(parseCsv("Tên;Giá\nGạo;85.000")).toEqual([["Tên", "Giá"], ["Gạo", "85.000"]]);
  });
});

describe("autoMap", () => {
  it("maps Vietnamese and English headers, ignoring accents and case", () => {
    expect(autoMap(["Tên món đồ", "Danh mục", "Vị trí", "SỐ LƯỢNG", "HSD", "Ngưỡng cảnh báo", "Thẻ", "Mã vạch", "Nhóm", "???"])).toEqual([
      "name", "category", "location", "quantity", "expiry_date", "min_quantity", "tags", "barcode", "group", null,
    ]);
    expect(autoMap(["name", "purchase_price", "warranty_until", "id", "name"])).toEqual(["name", "purchase_price", "warranty_until", "id", null]);
  });
});

describe("buildRow", () => {
  const mapping = autoMap(["Tên", "Tình trạng", "Hạn sử dụng", "Thẻ", "Lưu trữ", "notes"]);
  it("normalises dates, conditions, tags and flags", () => {
    const { row, problems } = buildRow(["Sữa tươi", "Mới", "05/11/2026", "#sữa; tủ lạnh", "có", "'=1+1"], mapping);
    expect(problems).toEqual([]);
    expect(row).toEqual({ name: "Sữa tươi", condition: "new", expiry_date: "2026-11-05", tags: ["sữa", "tủ lạnh"], archived: true, notes: "=1+1" });
  });
  it("reports missing names, bad dates and unknown conditions", () => {
    const { problems } = buildRow(["", "lạ", "31/02/2026", "", "", ""], mapping);
    expect(problems.map((p) => `${p.field}:${p.code}`)).toEqual(["condition:condition", "expiry_date:date", "name:required"]);
  });
  it("accepts several date styles", () => {
    expect(normalizeDate("2026-03-12")).toBe("2026-03-12");
    expect(normalizeDate("12.3.26")).toBe("2026-03-12");
    expect(normalizeDate("2026-03-12T00:00:00+07:00")).toBe("2026-03-12");
    expect(normalizeDate("12/13/2026")).toBeNull();
  });
});
