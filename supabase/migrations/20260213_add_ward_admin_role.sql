-- Add ward_admin role for managing agents in specific wards

-- Add new role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ward_admin';

-- Add ward_number column to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS ward_number TEXT;

-- Create helper function to check if user is ward_admin for a specific ward
CREATE OR REPLACE FUNCTION public.is_ward_admin(_user_id UUID, _ward_number TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'ward_admin' AND ward_number = _ward_number
  )
$$;

-- Drop existing agents policies
DROP POLICY IF EXISTS "Admins manage agents" ON public.agents;
DROP POLICY IF EXISTS "Operators read agents" ON public.agents;
DROP POLICY IF EXISTS "Operators verify agents" ON public.agents;

-- New agents policies
CREATE POLICY "Admins manage all agents" ON public.agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ward admins manage their ward agents" ON public.agents FOR ALL TO authenticated
  USING (public.is_ward_admin(auth.uid(), ward_number));

CREATE POLICY "Operators and ward admins read agents" ON public.agents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'ward_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators and ward admins verify agents" ON public.agents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'operator') OR public.is_ward_admin(auth.uid(), ward_number));

-- Drop existing reports policies
DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
DROP POLICY IF EXISTS "Operators read reports" ON public.reports;
DROP POLICY IF EXISTS "Operators create reports" ON public.reports;

-- New reports policies
CREATE POLICY "Admins manage all reports" ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ward admins manage their ward reports" ON public.reports FOR ALL TO authenticated
  USING (public.is_ward_admin(auth.uid(), ward_number));

CREATE POLICY "Operators and ward admins read reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator') OR public.is_ward_admin(auth.uid(), ward_number) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators and ward admins create reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'operator') OR public.is_ward_admin(auth.uid(), ward_number)) AND auth.uid() = operator_id);
