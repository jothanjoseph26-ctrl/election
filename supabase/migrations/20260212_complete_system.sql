-- =============================================
-- ELECTION RESULTS SYSTEM - SUPABASE MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CREATE TABLES
-- =============================================

-- Wards Table
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_number VARCHAR(10) NOT NULL UNIQUE,
    ward_name VARCHAR(255) NOT NULL,
    lga VARCHAR(100) DEFAULT 'AMAC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polling Units Table
CREATE TABLE IF NOT EXISTS polling_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ward_id, unit_number)
);

-- Election Results Table
CREATE TABLE IF NOT EXISTS election_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID,
    polling_unit_id TEXT,
    ward_id TEXT,
    election_type VARCHAR(50) DEFAULT 'governor',
    total_registered_voters INTEGER DEFAULT 0,
    total_accredited_voters INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    valid_votes INTEGER DEFAULT 0,
    invalid_votes INTEGER DEFAULT 0,
    party_results JSONB DEFAULT '{}',
    result_image_url TEXT,
    result_image_public_id TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Groups Table
CREATE TABLE IF NOT EXISTS whatsapp_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(255) NOT NULL,
    group_id TEXT,
    description TEXT,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
    agent_id UUID,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    sender_name TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Analytics Table
CREATE TABLE IF NOT EXISTS whatsapp_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    total_groups INTEGER DEFAULT 0,
    active_agents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADD COLUMNS TO EXISTING TABLES
-- =============================================

-- Add columns to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS polling_unit_id TEXT,
ADD COLUMN IF NOT EXISTS account_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS agent_role VARCHAR(50) DEFAULT 'polling_agent',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =============================================
-- CREATE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_election_results_agent ON election_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_election_results_ward ON election_results(ward_id);
CREATE INDEX IF NOT EXISTS idx_election_results_status ON election_results(status);
CREATE INDEX IF NOT EXISTS idx_polling_units_ward ON polling_units(ward_id);
CREATE INDEX IF NOT EXISTS idx_wards_number ON wards(ward_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_name ON whatsapp_groups(group_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_group ON whatsapp_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_analytics_date ON whatsapp_analytics(date);

-- =============================================
-- INSERT DEFAULT WARDS
-- =============================================

INSERT INTO wards (ward_number, ward_name, lga) VALUES
    ('01', 'WUSE WARD', 'AMAC'),
    ('02', 'GWAGWA WARD', 'AMAC'),
    ('03', 'CITY CENTRE WARD', 'AMAC'),
    ('04', 'GARKI WARD', 'AMAC'),
    ('05', 'KABUSA WARD', 'AMAC'),
    ('06', 'KARU WARD', 'AMAC'),
    ('07', 'KARSHI WARD', 'AMAC'),
    ('08', 'JIWA WARD', 'AMAC'),
    ('09', 'OROZO WARD', 'AMAC'),
    ('10', 'NYANYA WARD', 'AMAC'),
    ('11', 'GUI WARD', 'AMAC'),
    ('12', 'GWARINPA WARD', 'AMAC')
ON CONFLICT (ward_number) DO NOTHING;

-- =============================================
-- INSERT POLLING UNITS
-- =============================================

-- WUSE WARD (01) Polling Units
INSERT INTO polling_units (ward_id, unit_number, unit_name, location) 
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Wuse Zone I/Near Habib Bank', 'Wuse'),
        ('002', 'Wuse Zone I/Nat. Prov. Office', 'Wuse'),
        ('003', 'Wuse Zone I/Nat. Prov. Off', 'Wuse'),
        ('004', 'Wuse Zone II/Wuse I Pri. Sch.', 'Wuse'),
        ('005', 'Wuse Zone II/Wuse I Pri. Sch. II', 'Wuse'),
        ('006', 'Wuse Zone II/Wuse I Pri. Sch. II', 'Wuse'),
        ('007', 'Wuse Zone II/Security Post Two', 'Wuse'),
        ('008', 'Wuse Zone II/VGSS Wuse', 'Wuse'),
        ('009', 'Wuse Zone III/GSS Wuse', 'Wuse'),
        ('010', 'Wuse Zone III/Wuse II Pri. Sch.', 'Wuse'),
        ('011', 'Wuse Zone IV/GSS Tudun Wada', 'Wuse'),
        ('012', 'Wuse Zone IV/Ibrahim Sani Abacha/Estate Gate', 'Wuse'),
        ('013', 'Wuse Zone IV/Model Pri. Sch.', 'Wuse'),
        ('014', 'Wuse Zone 6/Wuse III Pri. Sch.', 'Wuse'),
        ('015', 'Wuse Zone 6/Naude St. Opp. Road Safety', 'Wuse'),
        ('016', 'Wuse Zone 6/Dev. Control Office', 'Wuse'),
        ('017', 'Wuse Zone 7/Security Post Education Bank', 'Wuse'),
        ('018', 'Wuse 2/OAU Qrts. near AP Plaza', 'Wuse'),
        ('019', 'Wuse 2 (AP Plaza)OAU Qrts.', 'Wuse'),
        ('020', 'Wuse 2 (Banex Plaza) Rd Junction', 'Wuse')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '01'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- GWAGWA WARD (02)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'GWAGWA PU 001', 'Gwagwa'),
        ('002', 'GWAGWA PU 002', 'Gwagwa'),
        ('003', 'GWAGWA PU 003', 'Gwagwa'),
        ('004', 'GWAGWA PU 004', 'Gwagwa'),
        ('005', 'GWAGWA PU 005', 'Gwagwa'),
        ('006', 'GWAGWA PU 006', 'Gwagwa'),
        ('009', 'GWAGWA PU 009', 'Gwagwa'),
        ('010', 'GWAGWA PU 010', 'Gwagwa'),
        ('013', 'GWAGWA PU 013', 'Gwagwa'),
        ('014', 'GWAGWA PU 014', 'Gwagwa'),
        ('015', 'GWAGWA PU 015', 'Gwagwa'),
        ('016', 'GWAGWA PU 016', 'Gwagwa'),
        ('017', 'GWAGWA PU 017', 'Gwagwa'),
        ('018', 'GWAGWA PU 018', 'Gwagwa'),
        ('019', 'GWAGWA PU 019', 'Gwagwa'),
        ('020', 'GWAGWA PU 020', 'Gwagwa'),
        ('025', 'GWAGWA PU 025', 'Gwagwa'),
        ('026', 'GWAGWA PU 026', 'Gwagwa'),
        ('031', 'GWAGWA PU 031', 'Gwagwa'),
        ('032', 'GWAGWA PU 032', 'Gwagwa'),
        ('037', 'GWAGWA PU 037', 'Gwagwa'),
        ('038', 'GWAGWA PU 038', 'Gwagwa'),
        ('043', 'GWAGWA PU 043', 'Gwagwa'),
        ('044', 'GWAGWA PU 044', 'Gwagwa'),
        ('046', 'GWAGWA PU 046', 'Gwagwa'),
        ('047', 'GWAGWA PU 047', 'Gwagwa'),
        ('048', 'GWAGWA PU 048', 'Gwagwa'),
        ('055', 'GWAGWA PU 055', 'Gwagwa'),
        ('056', 'GWAGWA PU 056', 'Gwagwa'),
        ('057', 'GWAGWA PU 057', 'Gwagwa'),
        ('069', 'GWAGWA PU 069', 'Gwagwa'),
        ('070', 'GWAGWA PU 070', 'Gwagwa'),
        ('080', 'GWAGWA PU 080', 'Gwagwa'),
        ('081', 'GWAGWA PU 081', 'Gwagwa'),
        ('082', 'GWAGWA PU 082', 'Gwagwa')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '02'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- KABUSA WARD (05)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Kabusa/Kabusa Pri. Sch.', 'Kabusa'),
        ('002', 'Sharite/Shareti Village Centre', 'Kabusa'),
        ('003', 'Ketti/Ketti Pri. II School', 'Kabusa'),
        ('004', 'Wuru/Wuru Pry.Sch', 'Kabusa'),
        ('005', 'Burun/Burun Pri. School', 'Kabusa'),
        ('006', 'Takunshara/Takunshara Pri. School', 'Kabusa')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '05'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- KARU WARD (06)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Ungwan Pashe I/Central Primary Sch 001', 'Karu'),
        ('002', 'Ung. Pashe 1/ B.T.S Karu 002', 'Karu'),
        ('003', 'Ung. Pashe /Agricultural Ext. Office', 'Karu'),
        ('004', 'Ung. Ginar /Health Center', 'Karu'),
        ('007', 'Ung. Hausawa III/ After Salasi Rd', 'Karu'),
        ('009', 'Karu Site II/ Old Nepa Office', 'Karu'),
        ('011', 'Front of Karu Primary Health Care', 'Karu'),
        ('014', 'Jikwoyi/Jikwoyi Pri. Sch.', 'Karu'),
        ('015', 'Jikwoyi II/Jikwoyi Tokka Village', 'Karu'),
        ('016', 'Jikwoyi /Ung. Gade', 'Karu'),
        ('017', 'Jikwoyi/Jikwoyi Phase III', 'Karu'),
        ('018', 'Ung. Pashe /Central Primary Sch.I', 'Karu'),
        ('023', 'Ung. Pashe/Beside Junior Secondary', 'Karu'),
        ('024', 'Ung. Pashe II/B.T.S. Karu', 'Karu'),
        ('025', 'Ung Pashe by Transformer Junction', 'Karu'),
        ('026', 'Ung. Hausawa Women Center', 'Karu'),
        ('028', 'Ung. Pashe/Viewing Center', 'Karu'),
        ('031', 'Court Rd Opp. Upper Area Court', 'Karu'),
        ('033', 'Along City College Road', 'Karu'),
        ('034', 'Ung. Ginar by Police Out Post', 'Karu'),
        ('036', 'Ung. Ginar/Old Chief Palace', 'Karu'),
        ('037', 'Behind Upper Area Court Karu', 'Karu'),
        ('039', 'Opp Faith Link Global Pharmacy', 'Karu'),
        ('041', 'Ung. Hausawa II/House C11', 'Karu'),
        ('042', 'Warehouse Opp ECWA College', 'Karu'),
        ('044', 'Back of Ung. Tiv', 'Karu'),
        ('046', 'Ung. Hausawa by Concord House', 'Karu'),
        ('047', 'Ung. Hausawa by Viewing Center', 'Karu'),
        ('048', 'Salasi by Post Office Karu', 'Karu'),
        ('049', 'Opp Lock-up Shops Salasi', 'Karu'),
        ('051', 'Lona Hospital Junction', 'Karu'),
        ('053', 'Karu Site I/Opp Hendon College', 'Karu'),
        ('055', 'Karu Site Ministry of Industry', 'Karu'),
        ('058', 'Karu Site II Rechard Egbule', 'Karu'),
        ('061', 'Karu Site II beside New NEPA', 'Karu'),
        ('062', 'Karu Site II Agric Qrts', 'Karu'),
        ('063', 'Kugbo/ Kofar Sarki Kugbo', 'Karu'),
        ('068', 'Karu Site II B by Prezon Hotel', 'Karu'),
        ('074', 'Boko Mohammed Street Junction', 'Karu'),
        ('075', 'River Street by Treasure Orphanage', 'Karu'),
        ('076', 'Karu Village by Magistrate Court', 'Karu'),
        ('077', 'Karu Site IV/by Itsekiri Way', 'Karu'),
        ('079', 'Henry Chukwyedo Street', 'Karu'),
        ('083', 'Karu F.H.A. by FEPA Qrts', 'Karu'),
        ('084', 'Karu Site IV/beside NUC Qrts', 'Karu'),
        ('086', 'CBN Junction /AYM Shafa', 'Karu'),
        ('088', 'Jikwoyi/Jikwoyi Primary School II', 'Karu'),
        ('089', 'Jikwoyi /Jikwoyi Primary School III', 'Karu'),
        ('091', 'Jikwoyi/Pemi by Police Out Post', 'Karu'),
        ('095', 'Jikwoyi/Jikwoyi District Head', 'Karu'),
        ('097', 'Jikwoyi Gagadnapna by Chief Palace', 'Karu'),
        ('098', 'SSS Staff Quarters Znubwoyi', 'Karu'),
        ('102', 'Jikwoyi/Avigo by Transformer', 'Karu'),
        ('103', 'Jikwoyi/Jikwoyi II Tokko Village', 'Karu'),
        ('104', 'Jikwoyi Gagadnakma New Extension', 'Karu'),
        ('106', 'Jikwoyi/Ung. Gade NEPA Office', 'Karu'),
        ('107', 'Jikwoyi Ung. Gade Extension', 'Karu'),
        ('110', 'Jikwoyi/Zhibugna behind Glorious', 'Karu'),
        ('111', 'Jikwoyi Alabai/Opp JIP Heritage', 'Karu'),
        ('114', 'Jikwoyi Dagbanawooyi', 'Karu'),
        ('118', 'Karu Site 118/ near Area Court', 'Karu'),
        ('119', 'Jikwoyi/Gadna by Deeper Life', 'Karu')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '06'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- JIWA WARD (08)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('010', 'JIWA PU 010', 'Jiwa'),
        ('011', 'JIWA PU 011', 'Jiwa'),
        ('012', 'JIWA PU 012', 'Jiwa'),
        ('016', 'JIWA PU 016', 'Jiwa'),
        ('017', 'JIWA PU 017', 'Jiwa'),
        ('018', 'JIWA PU 018', 'Jiwa'),
        ('019', 'JIWA PU 019', 'Jiwa'),
        ('020', 'JIWA PU 020', 'Jiwa'),
        ('027', 'JIWA PU 027', 'Jiwa'),
        ('028', 'JIWA PU 028', 'Jiwa'),
        ('030', 'JIWA PU 030', 'Jiwa'),
        ('032', 'JIWA PU 032', 'Jiwa'),
        ('040', 'JIWA PU 040', 'Jiwa'),
        ('041', 'JIWA PU 041', 'Jiwa'),
        ('046', 'JIWA PU 046', 'Jiwa'),
        ('047', 'JIWA PU 047', 'Jiwa'),
        ('048', 'JIWA PU 048', 'Jiwa'),
        ('049', 'JIWA PU 049', 'Jiwa'),
        ('050', 'JIWA PU 050', 'Jiwa'),
        ('052', 'JIWA PU 052', 'Jiwa'),
        ('053', 'JIWA PU 053', 'Jiwa'),
        ('054', 'JIWA PU 054', 'Jiwa'),
        ('056', 'JIWA PU 056', 'Jiwa'),
        ('057', 'JIWA PU 057', 'Jiwa'),
        ('059', 'JIWA PU 059', 'Jiwa'),
        ('060', 'JIWA PU 060', 'Jiwa'),
        ('061', 'JIWA PU 061', 'Jiwa'),
        ('062', 'JIWA PU 062', 'Jiwa'),
        ('063', 'JIWA PU 063', 'Jiwa'),
        ('064', 'JIWA PU 064', 'Jiwa'),
        ('065', 'JIWA PU 065', 'Jiwa'),
        ('066', 'JIWA PU 066', 'Jiwa'),
        ('067', 'JIWA PU 067', 'Jiwa'),
        ('068', 'JIWA PU 068', 'Jiwa'),
        ('069', 'JIWA PU 069', 'Jiwa'),
        ('078', 'JIWA PU 078', 'Jiwa'),
        ('080', 'JIWA PU 080', 'Jiwa'),
        ('082', 'JIWA PU 082', 'Jiwa'),
        ('083', 'JIWA PU 083', 'Jiwa'),
        ('085', 'JIWA PU 085', 'Jiwa'),
        ('088', 'JIWA PU 088', 'Jiwa'),
        ('089', 'JIWA PU 089', 'Jiwa'),
        ('090', 'JIWA PU 090', 'Jiwa')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '08'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- OROZO WARD (09)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Orozo Primary School 001', 'Orozo'),
        ('002', 'Ungwan Sarki Village Centre', 'Orozo'),
        ('004', 'OROZO PU 004', 'Orozo'),
        ('010', 'Orozo Primary School II', 'Orozo'),
        ('011', 'Orozo Primary School III', 'Orozo'),
        ('012', 'Orozo Primary School IV', 'Orozo'),
        ('013', 'Orozo Primary School V', 'Orozo'),
        ('015', 'Orozo Primary School VII', 'Orozo'),
        ('016', 'Orozo Primary School VIII', 'Orozo'),
        ('017', 'Orozo Primary School IX', 'Orozo'),
        ('020', 'Ungwan Sarki Village Centre I', 'Orozo'),
        ('021', 'Ungwan Sarki Village Centre II', 'Orozo'),
        ('022', 'Ungwan Sarki Village', 'Orozo'),
        ('026', 'Primary School Kurudu', 'Orozo'),
        ('029', 'Primary School Kurudu IV', 'Orozo'),
        ('030', 'Primary School Kurudu IV', 'Orozo'),
        ('033', 'OROZO PU 033', 'Orozo'),
        ('040', 'OROZO PU 040', 'Orozo')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '09'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- GUI WARD (11)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'GUI PADA 001', 'Gui'),
        ('003', 'SAU KA 003', 'Gui'),
        ('004', 'GBESSA PRIMARY 004', 'Gui'),
        ('014', 'TOGE ANGUWAN 014', 'Gui'),
        ('015', 'TOGE PHC 015', 'Gui'),
        ('016', 'TOGE AMAPAWA 016', 'Gui'),
        ('017', 'TOGE 017', 'Gui'),
        ('019', 'TOGE KUYAMI', 'Gui'),
        ('024', 'ABUBAKAR HASHIMO GBESSA JSS', 'Gui'),
        ('025', 'GBESSA YETU 025', 'Gui'),
        ('048', 'TOGE KUYAMI', 'Gui')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '11'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- GWARINPA WARD (12)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('005', 'LEA Primary School 005', 'Gwarinpa'),
        ('012', 'Utako Village 012', 'Gwarinpa'),
        ('014', 'Primary School', 'Gwarinpa'),
        ('021', 'Piwoyi Village Center', 'Gwarinpa'),
        ('030', 'GWARINPA PU 030', 'Gwarinpa'),
        ('038', 'GWARINPA PU 038', 'Gwarinpa'),
        ('050', 'Primary School Block 050', 'Gwarinpa'),
        ('061', 'GWARINPA PU 061', 'Gwarinpa'),
        ('105', 'Jabi Primary School I', 'Gwarinpa'),
        ('110', 'Jabi Village, Jabi', 'Gwarinpa'),
        ('119', 'Dakibiu Village Jabi I', 'Gwarinpa'),
        ('120', 'Dakibiu Village II', 'Gwarinpa'),
        ('124', 'Kado Village IV Life', 'Gwarinpa'),
        ('125', 'LEA Primary School 125', 'Gwarinpa'),
        ('126', 'LEA Primary School 126', 'Gwarinpa'),
        ('130', 'Kado Raya', 'Gwarinpa'),
        ('139', 'Dape Village', 'Gwarinpa'),
        ('150', 'GWARINPA PU 150', 'Gwarinpa'),
        ('154', 'Women Centre 154', 'Gwarinpa'),
        ('159', 'GWARINPA PU 159', 'Gwarinpa'),
        ('165', 'GWARINPA PU 165', 'Gwarinpa'),
        ('174', 'GWARINPA PU 174', 'Gwarinpa'),
        ('182', 'GWARINPA PU 182', 'Gwarinpa')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '12'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- NYANYA WARD (10)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES ('001', 'Collection Centre Agents Nyanya Ward', 'Nyanya')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '10'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- KARSHI WARD (07)
INSERT INTO polling_units (ward_id, unit_number, unit_name, location)
SELECT w.id, p.unit_number, p.unit_name, p.location
FROM wards w
CROSS JOIN (
    VALUES 
        ('001', 'Karshi Location 1', 'Karshi'),
        ('002', 'Karshi Location 2', 'Karshi'),
        ('003', 'Karshi Location 3', 'Karshi'),
        ('004', 'Karshi Location 4', 'Karshi'),
        ('005', 'Karshi Location 5', 'Karshi')
) AS p(unit_number, unit_name, location)
WHERE w.ward_number = '07'
ON CONFLICT (ward_id, unit_number) DO NOTHING;

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all access to wards" ON wards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to polling_units" ON polling_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to election_results" ON election_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to whatsapp_groups" ON whatsapp_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to whatsapp_messages" ON whatsapp_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to whatsapp_analytics" ON whatsapp_analytics FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- VERIFICATION
-- =============================================

SELECT 'Wards created: ' || COUNT(*) FROM wards;
SELECT 'Polling units created: ' || COUNT(*) FROM polling_units;
