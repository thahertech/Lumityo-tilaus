-- Add email column to snow_orders table in Supabase
-- Run this SQL in your Supabase SQL editor

ALTER TABLE snow_orders 
ADD COLUMN email VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN snow_orders.email IS 'User email from profile (optional)';

-- Create an index for faster email searches (optional)
CREATE INDEX IF NOT EXISTS idx_snow_orders_email ON snow_orders(email);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'snow_orders' 
AND column_name = 'email';