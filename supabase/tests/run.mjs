// Runner pgTAP sem Docker: roda cada supabase/tests/*.test.sql contra SUPABASE_DB_URL.
// Cada arquivo já faz begin/…/select * from finish()/rollback, então nada persiste.
// Sai com código != 0 se algum arquivo produzir linha "not ok" ou erro de execução.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL não definida (ver .env / .env.example)');
  process.exit(2);
}

const files = readdirSync(here)
  .filter((f) => f.endsWith('.test.sql'))
  .sort();

if (files.length === 0) {
  console.error('nenhum arquivo *.test.sql em', here);
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  const sql = readFileSync(join(here, file), 'utf8');
  const client = new pg.Client({ connectionString: url });
  const tap = [];
  client.on('notice', (n) => n.message && tap.push(n.message));
  try {
    await client.connect();
    const results = await client.query(sql);
    const sets = Array.isArray(results) ? results : [results];
    for (const r of sets) {
      for (const row of r.rows ?? []) {
        const line = Object.values(row)[0];
        if (typeof line === 'string') tap.push(line);
      }
    }
  } catch (err) {
    tap.push('not ok - erro de execução: ' + err.message);
  } finally {
    await client.end().catch(() => {});
  }
  const bad = tap.filter((l) => /^not ok\b/.test(l.trim()));
  const okCount = tap.filter((l) => /^ok\b/.test(l.trim())).length;
  if (bad.length > 0) {
    failed += bad.length;
    console.log(`✗ ${file} — ${bad.length} falha(s), ${okCount} ok`);
    for (const l of tap) console.log('   ' + l);
  } else {
    console.log(`✓ ${file} — ${okCount} ok`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} assert(s) falharam`);
  process.exit(1);
}
console.log('\ntodos os testes pgTAP passaram');
