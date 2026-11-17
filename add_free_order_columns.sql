-- Add device_id and is_free_order columns to snow_orders table
-- Run this SQL in your Supabase SQL Editor

-- Add device_id column for device tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snow_orders' AND column_name = 'device_id') THEN
        ALTER TABLE snow_orders ADD COLUMN device_id TEXT;
        COMMENT ON COLUMN snow_orders.device_id IS 'Device identifier for tracking free order eligibility';
    END IF;
END $$;

-- Add is_free_order column for free order tracking  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snow_orders' AND column_name = 'is_free_order') THEN
        ALTER TABLE snow_orders ADD COLUMN is_free_order BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN snow_orders.is_free_order IS 'Flag indicating if this is a free promotional order';
    END IF;
END $$;

-- Create index for better performance on free order queries
CREATE INDEX IF NOT EXISTS idx_snow_orders_device_id ON snow_orders(device_id);
CREATE INDEX IF NOT EXISTS idx_snow_orders_is_free_order ON snow_orders(is_free_order);

-- Optional: Check the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'snow_orders' 
ORDER BY ordinal_position;