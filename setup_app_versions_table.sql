-- Create app_versions table for mandatory and optional updates
CREATE TABLE IF NOT EXISTS app_versions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  minimum_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  notes TEXT
);

-- Set up RLS (Row Level Security) to allow public read access
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON app_versions
  FOR SELECT
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_versions_update_timestamp
  BEFORE UPDATE ON app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_app_versions_timestamp();

-- Insert default values (adjust version numbers as needed)
INSERT INTO app_versions (minimum_version, latest_version, notes)
VALUES ('2.0.0', '2.5.1', 'Initial version tracking')
ON CONFLICT DO NOTHING;
