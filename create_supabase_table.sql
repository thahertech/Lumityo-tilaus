-- Create the snow_orders table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS snow_orders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  palvelu TEXT NOT NULL DEFAULT 'Lumityö',
  price TEXT,
  status TEXT DEFAULT 'odottaa',
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  info TEXT, -- Additional information field
  jatkuva_tilaus BOOLEAN DEFAULT FALSE, -- Recurring order flag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snow_orders' AND column_name = 'info') THEN
        ALTER TABLE snow_orders ADD COLUMN info TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snow_orders' AND column_name = 'jatkuva_tilaus') THEN
        ALTER TABLE snow_orders ADD COLUMN jatkuva_tilaus BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE snow_orders ENABLE ROW LEVEL SECURITY;

-- Allow public read access for MapApp
CREATE POLICY "Allow public read access" ON snow_orders
FOR SELECT USING (true);

-- Allow public insert for new orders
CREATE POLICY "Allow public insert" ON snow_orders
FOR INSERT WITH CHECK (true);

-- Allow public update for status changes
CREATE POLICY "Allow public update" ON snow_orders
FOR UPDATE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_snow_orders_status ON snow_orders(status);
CREATE INDEX idx_snow_orders_created_at ON snow_orders(created_at);
CREATE INDEX idx_snow_orders_palvelu ON snow_orders(palvelu);

-- Add some sample data (optional)
INSERT INTO snow_orders (name, address, phone, palvelu, price, status, lat, lon) VALUES
('Testi Käyttäjä', 'Mannerheimintie 1, Helsinki', '+358401234567', 'Lumityö', '15€', 'odottaa', 60.1699, 24.9384),
('Matti Meikäläinen', 'Keskuskatu 5, Tampere', '+358407654321', 'Polanteen poisto', '25€', 'kuitattu', 61.4978, 23.7610);