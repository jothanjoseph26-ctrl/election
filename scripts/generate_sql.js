import { readFileSync, writeFileSync } from 'fs';

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
      ward_name: parts[4]
    };
  })
  .filter(a => a !== null);

const sql = ['DELETE FROM agents;'];
for (const a of agents) {
  const name = a.full_name.replace(/'/g, "''");
  const wardName = a.ward_name.replace(/'/g, "''");
  sql.push(`INSERT INTO agents (full_name, phone_number, ward_number, ward_name, pin, payment_status, verification_status, is_active) VALUES ('${name}', '${a.phone_number}', '${a.ward_number}', '${wardName}', '0000', 'pending', 'pending', true);`);
}

writeFileSync('agents/insert_agents.sql', sql.join('\n'), 'utf8');
console.log(`Generated SQL with ${agents.length} inserts`);
