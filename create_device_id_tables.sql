-- SQL to create tables with device_id for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Add device_id column to existing snow_orders table
ALTER TABLE snow_orders 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_snow_orders_device_id ON snow_orders(device_id);

-- Add is_free_order column if missing
ALTER TABLE snow_orders 
ADD COLUMN IF NOT EXISTS is_free_order BOOLEAN DEFAULT FALSE;

-- 2. Create user_profiles table (device-based, no authentication)
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public access (device-based app, no auth)
CREATE POLICY "Allow public read access" ON user_profiles
FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON user_profiles
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON user_profiles
FOR UPDATE USING (true);

-- Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_device_id ON user_profiles(device_id);

-- Note: order_settings table NOT needed
-- We use snow_orders.jatkuva_tilaus column instead
-- A device has jatkuva tilaus enabled if it has any order with jatkuva_tilaus = true

-- 4. Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_snow_orders_updated_at ON snow_orders;
CREATE TRIGGER update_snow_orders_updated_at
    BEFORE UPDATE ON snow_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
