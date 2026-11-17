# App Update System - Setup Guide

## Overview
The Lumityöt app now supports mandatory and optional updates:
- **Mandatory updates** block access until the user updates
- **Optional updates** show a banner suggestion with a "Later" option

## Setup Instructions

### 1. Create the Database Table

Run the SQL in Supabase SQL Editor:
```bash
# File: setup_app_versions_table.sql
```

Or manually in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS app_versions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  minimum_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  notes TEXT
);

ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON app_versions
  FOR SELECT
  USING (true);
```

### 2. Configure Version Requirements

In Supabase, go to `app_versions` table and update:
- `minimum_version`: Minimum version users must have (e.g., "2.0.0") - blocks access below this
- `latest_version`: Latest available version (e.g., "2.5.1") - shows optional update below this
- `notes`: Optional notes about the update

Example:
```
minimum_version: "2.5.0"
latest_version: "2.5.1"
notes: "Critical security fixes"
```

### 3. How It Works

**On App Launch:**
1. App checks Supabase for `minimum_version` and `latest_version`
2. If current version < `minimum_version`:
   - Shows modal blocking access
   - User must tap "Update Now" to open App Store/Play Store
3. If current version < `latest_version`:
   - Shows optional update modal
   - User can tap "Later" to dismiss or "Update Now"

### 4. Version Format

Versions must follow semantic versioning: `MAJOR.MINOR.PATCH`
- Valid: "1.0.0", "2.5.1", "3.0.0-beta"
- Invalid: "1", "2.5", "v2.5.1"

### 5. App Store Links

The system automatically generates:
- **iOS**: Opens App Store with app ID from app.json
- **Android**: Opens Google Play Store with package name from app.json

### 6. Testing

To test locally:
1. Update `app.json` version to test version
2. Set `minimum_version` in Supabase to a higher version
3. Run the app - should see mandatory update modal
4. Tap "Update Now" - opens store page

## Files Modified

- `App.js` - Added version check on startup, UpdateModal integration
- `components/UpdateModal.js` - Modal UI for update prompts
- `utils/versionCheck.js` - Version comparison logic and store URLs

## Example Supabase Rows

### Mandatory Update (blocks app)
```
minimum_version: "2.5.0"
latest_version: "2.5.1"
notes: "Critical bug fix - app requires update"
```

### Optional Update (banner only)
```
minimum_version: "2.0.0"
latest_version: "2.5.1"
notes: "New features available"
```

### No Updates Needed
```
minimum_version: "2.5.1"
latest_version: "2.5.1"
notes: "On latest version"
```

## Notes

- Version check happens on app launch
- If Supabase is unreachable, app blocks access (safest approach)
- Modify `versionCheck.js` behavior in `checkAppVersion()` if needed
- Always increment version in `app.json` when deploying new builds
