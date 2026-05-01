import 'dotenv/config';

export default {
  expo: {
    name: "Lumityöt",
    slug: "Lumiwork",
    version: "2.2.5",
    sdkVersion: "54.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    ios: {
      supportsTablet: false,
      buildNumber: "13",
      bundleIdentifier: "com.senseitechh.Lumiwork"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.senseitechh.Lumiwork",
      versionCode: 13
    },
    web: {
      favicon: "./assets/icon.png"
    },
    plugins: [
      "expo-asset",
      "expo-font"
    ],
    assetBundlePatterns: [
      "**/*"
    ],
    extra: {
      eas: {
        projectId: "ae040a3f-e178-4831-b486-7415e1a8e042"
      },
      // Environment variables available to the app
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      emailjsServiceId: process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID,
      emailjsTemplateId: process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID,
      emailjsUserId: process.env.EXPO_PUBLIC_EMAILJS_USER_ID,
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      opencageApiKey: process.env.EXPO_PUBLIC_OPENCAGE_API_KEY,
    }
  }
};