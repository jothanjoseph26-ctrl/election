import { readFileSync } from 'fs';

const supabaseUrl = 'https://nttbjzqgcdmrgbjmvlcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dGJqenFnY2Rtcmdiam12bGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDA3NTMsImV4cCI6MjA4NjQ3Njc1M30.ntKLVYuqL9glQUVjl46fIpZX0lo7L1k-tfPZk_nA4EI';

const csvContent = readFileSync('agents/agents_import_ready.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1);

const agents = lines
  .filter(line => line.trim())
  .map(line => {
    const parts = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
    if (!parts) return null;
    return {
      full_name: parts[1],
      phone_number: parts[2],
      ward_number: parts[3],
      ward_name: parts[4],
      is_active: true
    };
  })
  .filter(a => a !== null);

console.log(`Loaded ${agents.length} agents from CSV`);

async function insertBatch(batch, retry = 0) {
  const response = await fetch(`${supabaseUrl}/rest/v1/agents`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(batch)
  });
  
  if (!response.ok && retry < 3) {
    console.log(`Retry ${retry + 1}...`);
    return insertBatch(batch, retry + 1);
  }
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Error:', response.status, error);
    return false;
  }
  return true;
}

async function main() {
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < agents.length; i += batchSize) {
    const batch = agents.slice(i, i + batchSize);
    const success = await insertBatch(batch);
    if (success) {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${agents.length}`);
    }
  }
  
  // Verify
  const verify = await fetch(`${supabaseUrl}/rest/v1/agents?select=count`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' }
  });
  console.log('Final count:', verify.headers.get('content-range'));
}

main();
