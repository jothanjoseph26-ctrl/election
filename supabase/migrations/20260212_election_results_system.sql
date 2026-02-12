-- Migration: Election Results System
-- Date: 2026-02-12

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create polling_units table
CREATE TABLE IF NOT EXISTS polling_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id UUID NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ward_id, unit_number)
);

-- Create wards table
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_number VARCHAR(10) NOT NULL UNIQUE,
    ward_name VARCHAR(255) NOT NULL,
    lga VARCHAR(100) DEFAULT 'AMAC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to agents table for election system
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS polling_unit_id UUID REFERENCES polling_units(id),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS agent_role VARCHAR(50) DEFAULT 'polling_agent',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create election_results table
CREATE TABLE IF NOT EXISTS election_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    polling_unit_id UUID REFERENCES polling_units(id),
    ward_id UUID REFERENCES wards(id),
    
    -- Results data
    election_type VARCHAR(50) DEFAULT 'governor' NOT NULL,
    total_registered_voters INTEGER DEFAULT 0,
    total_accredited_voters INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    valid_votes INTEGER DEFAULT 0,
    invalid_votes INTEGER DEFAULT 0,
    
    -- Party results (JSON for flexibility)
    party_results JSONB DEFAULT '{}',
    
    -- Image of result sheet
    result_image_url TEXT,
    result_image_public_id TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ward_admins table (for ward-level users)
CREATE TABLE IF NOT EXISTS ward_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'ward_admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ward_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_election_results_agent ON election_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_election_results_ward ON election_results(ward_id);
CREATE INDEX IF NOT EXISTS idx_election_results_poll ON election_results(polling_unit_id);
CREATE INDEX IF NOT EXISTS idx_election_results_status ON election_results(status);
CREATE INDEX IF NOT EXISTS idx_agents_ward ON agents(ward_number);
CREATE INDEX IF NOT EXISTS idx_polling_units_ward ON polling_units(ward_id);
CREATE INDEX IF NOT EXISTS idx_ward_admins_user ON ward_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_ward_admins_ward ON ward_admins(ward_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_election_results_updated_at 
    BEFORE UPDATE ON election_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wards_updated_at 
    BEFORE UPDATE ON wards 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_polling_units_updated_at 
    BEFORE UPDATE ON polling_units 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create real-time subscription for election results
ALTER TABLE election_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_admins ENABLE ROW LEVEL SECURITY;

-- Create policies for election_results
DROP POLICY IF EXISTS "election_results_select_policy" ON election_results;
CREATE POLICY "election_results_select_policy" ON election_results 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "election_results_insert_policy" ON election_results;
CREATE POLICY "election_results_insert_policy" ON election_results 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "election_results_update_policy" ON election_results;
CREATE POLICY "election_results_update_policy" ON election_results 
    FOR UPDATE USING (true);

-- Insert default wards for AMAC
INSERT INTO wards (ward_number, ward_name, lga) VALUES
    ('01', 'Wuse Ward', 'AMAC'),
    ('02', 'Gwagwa Ward', 'AMAC'),
    ('03', 'City Centre Ward', 'AMAC'),
    ('04', 'Garki Ward', 'AMAC'),
    ('05', 'Kabusa Ward', 'AMAC'),
    ('06', 'Karu Ward', 'AMAC'),
    ('07', 'Karshi Ward', 'AMAC'),
    ('08', 'Jiwa Ward', 'AMAC'),
    ('09', 'Orozo Ward', 'AMAC'),
    ('10', 'Nyanya Ward', 'AMAC'),
    ('11', 'Gui Ward', 'AMAC'),
    ('12', 'Gwarinpa Ward', 'AMAC')
ON CONFLICT (ward_number) DO NOTHING;

-- Insert some sample polling units
INSERT INTO polling_units (ward_id, unit_number, unit_name, location) 
SELECT 
    w.id,
    p.unit_number,
    p.unit_name,
    p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Wuse Ward PU 001', 'Wuse'),
        ('002', 'Wuse Ward PU 002', 'Wuse'),
        ('003', 'Wuse Ward PU 003', 'Wuse'),
        ('001', 'Gwagwa Ward PU 001', 'Gwagwa'),
        ('002', 'Gwagwa Ward PU 002', 'Gwagwa'),
        ('001', 'City Centre PU 001', 'Central'),
        ('002', 'City Centre PU 002', 'Central'),
        ('001', 'Garki Ward PU 001', 'Garki'),
        ('002', 'Garki Ward PU 002', 'Garki')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = 
    CASE 
        WHEN p.unit_number LIKE '00%' AND p.unit_number < '005' THEN '01'
        WHEN p.unit_number LIKE '00%' AND p.unit_number >= '005' THEN '02'
        WHEN p.unit_number LIKE '00%' AND p.unit_number >= '007' THEN '03'
        WHEN p.unit_number LIKE '00%' AND p.unit_number >= '009' THEN '04'
        ELSE '01'
    END;
