-- Assign roles to users
-- Run this in Supabase SQL Editor

-- First, remove old admin role from floodgatesautomation (if exists)
DELETE FROM public.user_roles 
WHERE user_id = '03c5c568-e720-4614-89eb-4ce5ec380424' AND role = 'admin';

-- floodgatesautomation@gmail.com as ward_admin for WUSE WARD
INSERT INTO public.user_roles (user_id, role, ward_number) 
VALUES ('03c5c568-e720-4614-89eb-4ce5ec380424', 'ward_admin', 'WUSE WARD')
ON CONFLICT (user_id, role) DO NOTHING;

-- jacksonnigeria@gmail.com as operator
INSERT INTO public.user_roles (user_id, role) 
VALUES ('e4ef6962-7e42-47cc-bc1e-f389f628c11f', 'operator')
ON CONFLICT (user_id, role) DO NOTHING;

-- info@diamondheartofcare.com.ng as operator
INSERT INTO public.user_roles (user_id, role) 
VALUES ('9aeffa53-2a10-42be-921e-851b1b865e78', 'operator')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify assignments
SELECT 
  p.email,
  ur.role,
  ur.ward_number
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.user_id;
