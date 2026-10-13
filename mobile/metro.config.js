const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// APK builds share RAM with Gradle/Kotlin/C++; keep Metro from spawning a
// worker per CPU while leaving development and web exports at Expo defaults.
if (process.env.MAMOGRAFIA_LOCAL_APK_BUILD === "1") config.maxWorkers = 2;

module.exports = config;
