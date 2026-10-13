/* global __dirname */
const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, copyFileSync } = require("node:fs");
const path = require("node:path");
const { PUBLIC_API, releaseApi, checkApi } = require("./apk-api.cjs");

const project = path.resolve(__dirname, "..");
const checkOnly = process.argv.includes("--check");

function run(command, args, cwd = project) {
  execFileSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}

async function main() {
try {
  if (process.argv.slice(2).some((arg) => arg !== "--check")) {
    throw new Error("Use npm run build:apk ou npm run build:apk:check.");
  }
  if (process.platform !== "win32") {
    throw new Error("Este comando foi preparado para o Windows com Android SDK e Java instalados.");
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error("O Expo 57 precisa de Node.js 22.13 ou mais recente.");
  }
  const expoCli = path.join(project, "node_modules", "expo", "bin", "cli");
  if (!existsSync(expoCli)) throw new Error("Execute npm install na pasta mobile primeiro.");

  // Load the same production .env files used by Expo, without printing their values.
  process.env.NODE_ENV = "production";
  require("@expo/env").loadProjectEnv(project, { silent: true });
  const api = releaseApi(process.env.EXPO_PUBLIC_API_URL || PUBLIC_API);
  process.env.EXPO_PUBLIC_API_URL = api.toString();
  console.log("API do APK: " + api.origin + api.pathname);
  await checkApi(api);
  console.log("API pública respondeu /health com status ok.");

  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"));
  if (!sdk || !existsSync(path.join(sdk, "platforms", "android-36", "android.jar"))) {
    throw new Error("Configure ANDROID_HOME com o SDK e instale Android SDK Platform 36 no Android Studio.");
  }
  if (!existsSync(path.join(sdk, "build-tools", "36.0.0", "aapt2.exe"))) {
    throw new Error("Instale Android SDK Build-Tools 36.0.0 no SDK Manager do Android Studio.");
  }
  process.env.ANDROID_HOME = sdk;
  process.env.ANDROID_SDK_ROOT = sdk;

  const studioJava = path.join(process.env.ProgramFiles || "C:\\Program Files", "Android", "Android Studio", "jbr");
  const javaHome = process.env.JAVA_HOME || (existsSync(path.join(studioJava, "bin", "javac.exe")) ? studioJava : null);
  if (!javaHome || !existsSync(path.join(javaHome, "bin", "javac.exe"))) {
    throw new Error("Configure JAVA_HOME com um JDK 17 ou mais recente.");
  }
  const java = path.join(javaHome, "bin", "java.exe");
  const javaInfo = spawnSync(java, ["-XshowSettings:properties", "-version"], { encoding: "utf8", windowsHide: true });
  const javaMajor = Number((javaInfo.stderr || "").match(/java\.specification\.version\s*=\s*(\d+)/)?.[1]);
  if (javaInfo.error || javaInfo.status !== 0 || !javaMajor || javaMajor < 17) {
    throw new Error("JAVA_HOME deve apontar para um JDK 17 ou mais recente que consiga executar java.");
  }
  process.env.JAVA_HOME = javaHome;
  process.env.PATH = path.join(javaHome, "bin") + path.delimiter + process.env.PATH;

  console.log("Java: " + javaHome);
  console.log("Android SDK: " + sdk);
  if (checkOnly) {
    const config = JSON.parse(execFileSync(process.execPath, [expoCli, "config", "--type", "public", "--json"], {
      cwd: project, env: process.env, encoding: "utf8", windowsHide: true,
    }));
    if (!config.android?.package) throw new Error("Configure o package Android em app.json.");
    console.log("Aplicativo Android: " + config.android.package);
    console.log("Ambiente validado. Execute npm run build:apk para gerar o APK.");
    process.exit(0);
  }

  console.log("Gerando/atualizando Android pelo Expo...");
  run(process.execPath, [expoCli, "prebuild", "--platform", "android", "--no-clean", "--no-install", "--skip-dependency-update", "react,react-native"]);
  const android = path.join(project, "android");
  if (!existsSync(path.join(android, "gradlew.bat"))) throw new Error("O Expo não gerou o Gradle Wrapper Android.");
  console.log("Compilando APK release com JavaScript incluído...");
  process.env.MAMOGRAFIA_LOCAL_APK_BUILD = "1";
  // Fixed command: paths and environment values are never interpolated into shell code.
  run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "gradlew.bat :app:assembleRelease --no-daemon --console=plain --stacktrace --max-workers=2"], android);
  const source = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk");
  if (!existsSync(source)) throw new Error("O build terminou sem gerar app-release.apk. Confira a configuração de assinatura.");
  const output = path.join(project, "builds", "dominando-mamografia.apk");
  mkdirSync(path.dirname(output), { recursive: true });
  copyFileSync(source, output);
  console.log("APK gerado: " + output);
} catch (error) {
  console.error("Build APK interrompido: " + error.message);
  process.exit(typeof error.status === "number" && error.status > 0 ? error.status : 1);
}
}
main();
