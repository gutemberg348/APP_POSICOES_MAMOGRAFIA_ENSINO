const { withGradleProperties } = require("expo/config-plugins");

// RNGMA 17.2.0 reads a missing googleMobileAdsJson property when app.json
// only contains Expo configuration. Select its default backend explicitly
// using the library's supported Gradle setting, preserving Expo manifest IDs.
module.exports = function withAdsAndroidBackend(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (entry) => entry.type !== "property" || entry.key !== "RNGMA_ANDROID_BACKEND",
    );
    mod.modResults.push({ type: "property", key: "RNGMA_ANDROID_BACKEND", value: "classic" });
    return mod;
  });
};
