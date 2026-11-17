-- Add Jatkuva Tilaus (subscription) support to snow_orders table
-- Run this SQL in your Supabase SQL Editor

-- Add simple subscription field to existing table
ALTER TABLE snow_orders 
ADD COLUMN IF NOT EXISTS jatkuva_tilaus BOOLEAN DEFAULT FALSE;

-- Update table comments
COMMENT ON COLUMN snow_orders.jatkuva_tilaus IS 'Whether this is a continuous subscription order (Jatkuva Tilaus)';

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_snow_orders_subscription ON snow_orders(jatkuva_tilaus);

-- Check updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'snow_orders' 
ORDER BY ordinal_position;