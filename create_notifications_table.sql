-- Create notifications table for dynamic banner messages
-- Run this SQL in your Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
  type VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NULL, -- NULL means no expiry
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dates ON notifications(start_date, end_date);

-- Add Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading active notifications
CREATE POLICY "Allow reading active notifications" ON notifications
  FOR SELECT USING (
    is_active = true 
    AND start_date <= NOW() 
    AND (end_date IS NULL OR end_date > NOW())
  );

-- Create policy for admin management (adjust as needed)
CREATE POLICY "Allow all operations for authenticated users" ON notifications
  FOR ALL USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE notifications IS 'System notifications displayed in app banners';
COMMENT ON COLUMN notifications.message IS 'The notification message text to display';
COMMENT ON COLUMN notifications.is_active IS 'Whether the notification is currently active';
COMMENT ON COLUMN notifications.priority IS 'Display priority: 1=low, 2=medium, 3=high';
COMMENT ON COLUMN notifications.type IS 'Visual style type: info, warning, success, error';
COMMENT ON COLUMN notifications.start_date IS 'When notification becomes active';
COMMENT ON COLUMN notifications.end_date IS 'When notification expires (NULL = no expiry)';

-- Insert sample notification (optional)
INSERT INTO notifications (message, type, priority) 
VALUES ('Tervetuloa uuteen Lumityö-sovellukseen! 🎉', 'success', 2);

-- Query to check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;