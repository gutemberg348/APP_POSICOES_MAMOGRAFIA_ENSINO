const { withAppBuildGradle } = require("expo/config-plugins");

const block = `
    // @generated begin mamografia-short-cmake-path
    externalNativeBuild {
        cmake {
            buildStagingDirectory file("$rootDir/../../.cxx")
        }
    }
    // @generated end mamografia-short-cmake-path
`;

module.exports = function withShortCmakePath(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") {
      throw new Error("O ajuste de caminhos CMake exige o template Android Groovy do Expo.");
    }
    const contents = mod.modResults.contents.replace(/\r\n/g, "\n").replace(block, "");
    if (!/\bandroid\s*\{/.test(contents)) throw new Error("Bloco android não encontrado no template Gradle.");
    // A shorter staging directory lets CMake hash object paths below the Windows
    // 260-character limit. Source files and the Android project stay in place.
    mod.modResults.contents = contents.replace(/\bandroid\s*\{/, (match) => match + block);
    return mod;
  });
};
