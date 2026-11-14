-- Add 'info' column to snow_orders table to store additional information
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE snow_orders 
ADD COLUMN IF NOT EXISTS info TEXT;

-- Update the table comment to reflect the new field
COMMENT ON COLUMN snow_orders.info IS 'Additional information provided by the customer during order creation';

-- Optional: Check the updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'snow_orders' 
ORDER BY ordinal_position;