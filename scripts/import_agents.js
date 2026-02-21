import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://nttbjzqgcdmrgbjmvlcx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const csvContent = readFileSync('agents/agents_import_ready.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1); // Skip header

const agents = lines
  .filter(line => line.trim())
  .map(line => {
    const match = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
    if (!match) return null;
    return {
      full_name: match[1],
      phone_number: match[2],
      ward_number: match[3],
      ward_name: match[4],
      is_active: true
    };
  })
  .filter(a => a !== null);

console.log(`Loaded ${agents.length} agents from CSV`);

// Delete existing agents
console.log('Deleting existing agents...');
await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');

// Insert in batches
const batchSize = 100;
for (let i = 0; i < agents.length; i += batchSize) {
  const batch = agents.slice(i, i + batchSize);
  const { error } = await supabase.from('agents').insert(batch);
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log(`Inserted ${Math.min(i + batchSize, agents.length)}/${agents.length}`);
  }
}

console.log('Done!');
