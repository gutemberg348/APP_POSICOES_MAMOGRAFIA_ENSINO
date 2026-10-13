const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withAndroidBuildMemory(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (entry) => entry.type !== "property" || entry.key !== "org.gradle.jvmargs",
    );
    mod.modResults.push({
      type: "property",
      key: "org.gradle.jvmargs",
      value: "-Xmx2048m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
    });
    return mod;
  });
};
