import fs from 'node:fs';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

export async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return await res.json();
}

if (process.argv[2]) {
  const query = fs.readFileSync(process.argv[2], 'utf8');
  runSql(query)
    .then(r => console.log('Resultado:', JSON.stringify(r, null, 2)))
    .catch(e => console.error('Erro:', e));
}
