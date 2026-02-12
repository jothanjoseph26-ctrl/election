-- Add missing columns to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS polling_unit_id TEXT,
ADD COLUMN IF NOT EXISTS account_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS agent_role VARCHAR(50) DEFAULT 'polling_agent',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agents' 
ORDER BY ordinal_position;
