/**
 * Measures search_items latency end to end (HTTP → PostgREST → Postgres) as the demo user
 * and, when they exist, as the other members of the demo household.
 *   pnpm seed:demo --count 5000 --members 3 && pnpm bench:search
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import type { Database } from "../src/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const client = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
const password = process.env.DEMO_PASSWORD ?? "demo-password";

const CASES: { label: string; args: Database["public"]["Functions"]["search_items"]["Args"] }[] = [
  { label: "browse (no query)", args: {} },
  { label: "ao khoac", args: { p_query: "ao khoac" } },
  { label: "sạc", args: { p_query: "sạc" } },
  { label: "typo: lightnig", args: { p_query: "lightnig" } },
  { label: "location: phong ngu", args: { p_query: "phong ngu" } },
  { label: "low stock first", args: { p_states: ["low_stock", "out_of_stock"], p_sort: "low_stock" } },
  { label: "expiry sort", args: { p_states: ["expired", "expiring_soon"], p_sort: "expiry" } },
  { label: "name sort, page 20", args: { p_sort: "name", p_offset: 1000 } },
];

async function bench(email: string): Promise<number | null> {
  const db = client();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return null;
  const { data: role } = await db.rpc("current_household_role");
  const { count } = await db.from("items").select("id", { count: "exact", head: true });
  console.log(`\n${email} (${role}) — items: ${count}`);

  let worst = 0;
  for (const c of CASES) {
    const times: number[] = [];
    let total = 0;
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      const { data, error: e } = await db.rpc("search_items", { p_limit: 50, ...c.args });
      times.push(performance.now() - start);
      if (e) throw e;
      total = Number(data[0]?.total_count ?? 0);
    }
    times.splice(0, 2); // warm-up
    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    worst = Math.max(worst, p95);
    console.log(`${c.label.padEnd(24)} results=${String(total).padStart(5)}  p50=${p50.toFixed(0).padStart(4)}ms  p95=${p95.toFixed(0).padStart(4)}ms`);
  }
  return worst;
}

async function main() {
  const owner = process.env.DEMO_EMAIL ?? "demo@stowly.local";
  const ownerWorst = await bench(owner);
  if (ownerWorst === null) throw new Error(`Cannot sign in as ${owner}; run pnpm seed:demo first`);
  let worst = ownerWorst;
  // Other members of the same household (pnpm seed:demo --members N).
  for (let n = 1; n <= 10; n++) {
    const memberWorst = await bench(`demo-member-${n}@stowly.local`);
    if (memberWorst === null) break;
    worst = Math.max(worst, memberWorst);
  }
  console.log(`\nWorst p95: ${worst.toFixed(0)} ms (target < 200 ms)`);
  if (worst > 200) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
