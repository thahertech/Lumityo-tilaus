import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    emailjsServiceId: process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID,
    emailjsTemplateId: process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID,
    emailjsUserId: process.env.EXPO_PUBLIC_EMAILJS_USER_ID,
    mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    opencageApiKey: process.env.EXPO_PUBLIC_OPENCAGE_API_KEY,
  },
});
