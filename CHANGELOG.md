# Changelog

All notable changes to **Lumityö-tilaus** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.5.0] — 2025-05-01 — UI Redesign & Security Hardening

### Added
- `OrderMapPreview` component — interactive Mapbox satellite map with draggable pin on order screen
- Address coordinates saved when user selects an address; pin position can be adjusted before confirming
- Floating transparent navigation dock (bottom tabs) with glass pill active indicator
- Staggered entrance animations on HomeScreen buttons (spring physics, 90ms stagger)
- Banner animation with 1.4s delay on first view, smooth fade + scale + pulse on subsequent views
- Arrow blink animation on primary CTA ("Tilaa tästä") using `translateX` + opacity loop
- `utils/OrderHistoryUtils.js` — order history loader with Supabase status sync
- `react-native-webview` dependency for map rendering

### Changed
- HomeScreen completely redesigned: dark glass aesthetic, hero background, logo replaces all text/title
- OrderScreen color pass: dark navy glass containers, light white inputs with dark text
- Navigation dock: `position: absolute`, `rgba(15,23,42,0.82)` background, `borderRadius: 32`
- All screens updated with `paddingBottom` to prevent content from being hidden behind dock

### Fixed
- Removed all hardcoded Supabase credentials from `SupabaseAPI.js` — env-only
- Removed all hardcoded EmailJS fallbacks from `OmatTiedotScreen.js` — env-only
- Removed hardcoded Supabase credentials from `utils/OrderHistoryUtils.js` — env-only
- Removed `expo-sqlite` plugin from `app.config.js` (SQLite no longer used)
- Banner reserved slot prevents layout jank when notification appears/disappears

### Security
- All API keys moved exclusively to `.env`
- `.env` enforced in `.gitignore`

---

## [1.4.0] — Android Optimisation & Updates

### Changed
- Android-specific optimisations and layout fixes
- Header and status bar styling updates
- Image and data modifications across screens

---

## [1.3.0] — Version 2.0 Refactor

### Changed
- Full Android refactor to version 2.0
- Additional Android-specific updates
- Updated Expo SDK version

---

## [1.2.0] — Home & Profile UI Updates

### Changed
- Home page UI improvements
- Own info / profile page (`OmatTiedotScreen`) updates

---

## [1.1.0] — Local Database & Styling

### Added
- `FreeOrderUtils.js` — first-order-free eligibility via device ID
- `JatkuvaTilausStatus.js` — recurring order status display

### Changed
- Styling updates across all screens

---

## [1.0.0] — Initial Release

### Added
- `HomeScreen` with hero image and service navigation
- `OrderScreen` — order form with address autocomplete (Mapbox + OpenCage)
- `OmatTiedotScreen` — user profile, jatkuva tilaus toggle, contact form
- `ExtraScreen` — info and extras
- Supabase integration for order storage and retrieval
- EmailJS integration for contact form
- Bottom tab navigation
- Free first order system (device-ID based)
- Notification label for active promotions
