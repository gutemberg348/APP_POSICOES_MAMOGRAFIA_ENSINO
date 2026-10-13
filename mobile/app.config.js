const app = require("./app.json").expo;
const androidAppId =
  process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713";
if (!/^ca-app-pub-\d{16}~\d{10}$/.test(androidAppId))
  throw new Error("ADMOB_ANDROID_APP_ID inválido.");
module.exports = {
  ...app,
  extra: {
    ...app.extra,
    admobProductionConfigured:
      Boolean(process.env.ADMOB_ANDROID_APP_ID) &&
      androidAppId !== "ca-app-pub-3940256099942544~3347511713",
  },
  plugins: [
    ...app.plugins,
    ["expo-iap", { android: { store: "play" } }],
    "./plugins/withAdsAndroidBackend",
    "./plugins/withAndroidBuildMemory",
    "./plugins/withShortCmakePath",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId,
        iosAppId: "ca-app-pub-3940256099942544~1458002511",
        delayAppMeasurementInit: true,
      },
    ],
  ],
};
