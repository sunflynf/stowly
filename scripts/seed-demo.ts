/**
 * Seeds a demo account with realistic household items.
 *
 *   pnpm seed:demo                 # ~150 items for demo@stowly.local
 *   pnpm seed:demo --count 5000    # performance data set
 *   pnpm seed:demo --email me@x.com --password secret123 --count 300
 *
 * Uses the service-role key from .env.local. Existing items of the account are replaced.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import type { Database } from "../src/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");

const email = args.get("email") ?? "demo@stowly.local";
const password = args.get("password") ?? "demo-password";
const count = Number(args.get("count") ?? 150);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)");

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Deterministic pseudo-random numbers so runs are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
const today = new Date();
const isoOffset = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const CATALOG: Record<string, { names: string[]; locations: string[]; tags: string[] }> = {
  clothing: {
    names: ["Áo khoác mùa đông", "Áo sơ mi trắng", "Quần jean xanh", "Áo thun đen", "Giày thể thao", "Dép tông", "Áo len cổ lọ", "Váy hoa", "Tất cotton (đôi)", "Áo mưa", "Khăn quàng cổ", "Quần short kaki"],
    locations: ["wardrobe", "bedroom"],
    tags: ["mùa đông", "mùa hè", "đi làm", "thể thao"],
  },
  bedding: {
    names: ["Gối ngủ", "Gối ôm", "Chăn bông", "Ga trải giường 1m8", "Nệm cao su", "Vỏ gối lụa", "Chăn mỏng mùa hè", "Tấm bảo vệ nệm"],
    locations: ["bedroom", "wardrobe", "storage"],
    tags: ["phòng ngủ", "giặt định kỳ"],
  },
  electronics: {
    names: ["Dây sạc USB-C 1m", "Dây sạc USB-C 2m", "Cáp Lightning", "Dây sạc Micro-USB", "Củ sạc nhanh 65W", "Sạc dự phòng 20.000mAh", "Đế sạc không dây", "Laptop làm việc", "Chuột không dây", "Bàn phím cơ", "Loa bluetooth", "Tai nghe in-ear", "Ổ cắm điện 6 lỗ", "Pin AA", "Pin AAA", "Ổ cứng di động 1TB", "Cáp HDMI 2m", "Router wifi", "Điện thoại cũ"],
    locations: ["desk", "living_room", "tv_cabinet", "storage"],
    tags: ["sạc", "type-c", "cáp", "pin", "máy tính"],
  },
  stationery: {
    names: ["Bút bi xanh", "Bút bi đen", "Giấy A4 (ream)", "Sổ tay A5", "Bút dạ quang", "Băng keo trong", "Kéo văn phòng", "Ghim bấm", "Bút chì 2B", "Giấy note vàng"],
    locations: ["desk", "storage"],
    tags: ["văn phòng", "học tập"],
  },
  books: {
    names: ["Nhà giả kim", "Đắc nhân tâm", "Sapiens", "Tuổi trẻ đáng giá bao nhiêu", "Atomic Habits", "Dế mèn phiêu lưu ký", "Clean Code", "Rừng Na Uy", "Bố già", "Tôi thấy hoa vàng trên cỏ xanh"],
    locations: ["living_room", "bedroom", "desk"],
    tags: ["tiểu thuyết", "kỹ năng", "lập trình"],
  },
  food: {
    names: ["Dầu ăn 2L", "Sữa tươi hộp 1L", "Mì gói (thùng 30)", "Gạo ST25 5kg", "Nước mắm", "Cà phê hạt 500g", "Đường trắng 1kg", "Trà xanh túi lọc", "Bánh quy", "Đồ hộp cá ngừ", "Nước suối (thùng)", "Ngũ cốc"],
    locations: ["kitchen_shelf", "fridge", "kitchen"],
    tags: ["đồ khô", "đồ uống", "tủ lạnh"],
  },
  household: {
    names: ["Bóng đèn LED", "Nước rửa chén", "Giấy vệ sinh (lốc)", "Kem đánh răng", "Bàn chải đánh răng", "Nước giặt 3L", "Túi rác", "Khăn tắm", "Dầu gội", "Xà phòng", "Hộp dụng cụ", "Ô dù"],
    locations: ["bathroom", "kitchen", "storage", "living_room"],
    tags: ["tiêu hao", "vệ sinh", "dụng cụ"],
  },
};

async function getOrCreateUser(): Promise<string> {
  const { data: list, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !data.user) throw createError ?? new Error("createUser failed");
  return data.user.id;
}

async function main() {
  const userId = await getOrCreateUser();
  console.log(`Seeding ${count} items for ${email} (${userId})`);

  await db.from("items").delete().eq("user_id", userId);
  await db.from("tags").delete().eq("user_id", userId);
  await db.from("shopping_list").delete().eq("user_id", userId);

  const { data: categories } = await db.from("categories").select("id, builtin_key").eq("user_id", userId);
  const { data: locations } = await db.from("locations").select("id, builtin_key").eq("user_id", userId);
  const catId = new Map((categories ?? []).map((c) => [c.builtin_key, c.id]));
  const locId = new Map((locations ?? []).map((l) => [l.builtin_key, l.id]));

  // Extra boxes so search results show deeper paths, e.g. "Bàn làm việc › Ngăn kéo 2".
  const extra = [
    { parent: "desk", name: "Ngăn kéo 2", name_en: "Drawer 2", key: "desk_drawer" },
    { parent: "tv_cabinet", name: "Hộp cáp", name_en: "Cable box", key: "cable_box" },
    { parent: "storage", name: "Thùng đồ Tết", name_en: "Holiday box", key: "holiday_box" },
  ];
  for (const e of extra) {
    if (locId.has(e.key)) continue;
    const { data } = await db
      .from("locations")
      .insert({ user_id: userId, parent_id: locId.get(e.parent)!, name: e.name, name_en: e.name_en, builtin_key: e.key })
      .select("id")
      .single();
    if (data) locId.set(e.key, data.id);
  }
  CATALOG.electronics.locations.push("desk_drawer", "cable_box");
  CATALOG.household.locations.push("holiday_box");

  const tagNames = [...new Set(Object.values(CATALOG).flatMap((c) => c.tags))];
  const { data: tags } = await db
    .from("tags")
    .insert(tagNames.map((name) => ({ user_id: userId, name })))
    .select("id, name");
  const tagId = new Map((tags ?? []).map((t) => [t.name, t.id]));

  const keys = Object.keys(CATALOG);
  const rows: Database["public"]["Tables"]["items"]["Insert"][] = [];
  const rowTags: string[][] = [];
  for (let i = 0; i < count; i++) {
    const key = keys[i % keys.length];
    const cat = CATALOG[key];
    const base = pick(cat.names);
    const n = Math.floor(i / (keys.length * cat.names.length));
    const name = n > 0 ? `${base} #${n + 1}` : base;
    const consumable = key === "food" || key === "household" || key === "stationery" || base.startsWith("Pin") || base.startsWith("Dây sạc");
    const quantity = consumable ? Math.floor(rand() * 8) : 1;
    rows.push({
      user_id: userId,
      name,
      category_id: catId.get(key) ?? null,
      location_id: locId.get(pick(cat.locations)) ?? null,
      quantity,
      unit: key === "food" ? pick(["hộp", "gói", "chai", null]) : null,
      min_quantity: consumable && chance(0.7) ? Math.max(1, Math.floor(rand() * 5)) : null,
      condition: chance(0.08) ? "worn" : chance(0.05) ? "new" : "good",
      purchase_date: chance(0.6) ? isoOffset(-Math.floor(rand() * 900)) : null,
      purchase_price: chance(0.6) ? Math.round(rand() * 2_000) * 1000 : null,
      purchase_place: chance(0.3) ? pick(["Shopee", "Lazada", "Co.opmart", "Điện Máy Xanh", "Tiki"]) : null,
      expiry_date: key === "food" ? isoOffset(Math.floor(rand() * 200) - 10) : null,
      warranty_until: key === "electronics" && chance(0.4) ? isoOffset(Math.floor(rand() * 500) - 30) : null,
      replace_after_months: key === "bedding" && base.startsWith("Gối") ? 18 : null,
      notes: chance(0.15) ? pick(["Mua đợt sale", "Dùng cho phòng khách", "Còn bảo hành tại cửa hàng", "Để dự phòng"]) : null,
      attributes:
        key === "books"
          ? { author: pick(["Paulo Coelho", "Dale Carnegie", "Yuval Noah Harari", "Nguyễn Nhật Ánh", "James Clear"]), read_status: pick(["unread", "reading", "read"]) }
          : key === "electronics"
            ? { brand: pick(["Anker", "Ugreen", "Apple", "Samsung", "Xiaomi"]) }
            : {},
    });
    rowTags.push(cat.tags.filter(() => chance(0.35)));
  }

  const batch = 500;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += batch) {
    const { data, error } = await db.from("items").insert(rows.slice(start, start + batch)).select("id");
    if (error) throw error;
    const links = data.flatMap((item, j) =>
      rowTags[start + j].map((t) => ({ user_id: userId, item_id: item.id, tag_id: tagId.get(t)! })),
    );
    if (links.length) {
      const { error: tagError } = await db.from("item_tags").insert(links);
      if (tagError) throw tagError;
    }
    inserted += data.length;
    process.stdout.write(`\r  ${inserted}/${rows.length}`);
  }
  console.log(`\nDone. Sign in as ${email} / ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
