/* Tests exercise the Android React component with store/API adapters simulated.
   They do not build an APK and do not make purchases. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const Renderer = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
let options, resume;
let purchases = [], requests = [], endpoints = [];
let enabled = true, status = "PAID", failure = false, paid = 0;
const baseUser = { id: 8, name: "Teste", email: "test@example.test", role: "CLIENT", is_premium: 0 };
let initialUser = baseUser;
let currentUser;
const mockStore = {
  ErrorCode: { UserCancelled: "user-cancelled", AlreadyOwned: "already-owned" },
  useIAP(value) { options = value; return { connected: true, reconnect: async () => true }; },
  fetchProducts: async () => [{ id: "premium_vitalicio", platform: "android", type: "in-app", displayPrice: "R$ 39,90",
    discountOffers: [{ price: 39.9, displayPrice: "R$ 39,90", offerTokenAndroid: "buy-option" }] }],
  getAvailablePurchases: async () => purchases,
  requestPurchase: async (value) => { requests.push(value); return null; },
};
async function api(route, request) {
  endpoints.push(route);
  assert(!route.includes("asaas") && route !== "/billing/checkout", "Android must not call Asaas checkout");
  if (route.endsWith("/offer")) return { enabled, product_id: "premium_vitalicio", account_id: "opaque-account" };
  assert.equal(route, "/billing/google-play/verify");
  assert.deepEqual(Object.keys(request.body), ["purchase_token"]);
  if (failure) throw new Error("Servidor temporariamente indisponível");
  const trialActive = !!initialUser.trial_active && status !== "PAID";
  return { user: { ...currentUser, is_premium: status === "PAID" || trialActive ? 1 : 0,
      premium_permanent: status === "PAID", trial_active: trialActive },
    payment: { status, acknowledged: status === "PAID", is_test: false } };
}
const moduleResult = { exports: {} };
const filename = path.resolve(__dirname, "../src/PlayBilling.android.tsx");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: moduleResult.exports,
  require(name) {
    if (name === "expo-iap") return mockStore;
    if (name === "react-native") return { Text: "text", View: "view", AppState: { addEventListener(_, cb) {
      resume = cb; return { remove() { resume = undefined; } };
    } } };
    if (name === "./api") return { api };
    if (name === "./components") return { Button: (props) => React.createElement("button", props) };
    if (name === "./styles") return { s: {} };
    return require(name);
  },
  setTimeout, clearTimeout, console,
}, { filename });
const { PlayBillingProvider, GooglePlayPayment } = moduleResult.exports;
function Host() {
  const [user, setUser] = React.useState(initialUser);
  currentUser = user;
  return React.createElement(PlayBillingProvider, { user, onUser: setUser, onPaid: () => { paid++; } },
    React.createElement(GooglePlayPayment));
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 15));
async function settle() { for (let i = 0; i < 3; i++) await act(pause); }
function button(root, label) { return root.root.findAll((node) => node.type === "button" && node.props.label === label)[0]; }
function text(root) { return JSON.stringify(root.toJSON()); }
async function click(root, label) {
  const found = button(root, label);
  assert(found, "Missing button: " + label);
  await act(async () => { found.props.onPress(); await pause(); });
  await settle();
}
function purchase(account = "opaque-account") {
  return { productId: "premium_vitalicio", purchaseToken: "verified-token", obfuscatedAccountIdAndroid: account, purchaseState: "purchased" };
}
async function create() {
  let root;
  await act(async () => { root = Renderer.create(React.createElement(Host)); });
  await settle();
  return root;
}
(async () => {
  let root = await create();
  assert(text(root).includes("R$ 39,90"));
  await click(root, "Comprar pela Google Play");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, "in-app");
  assert.equal(requests[0].request.google.obfuscatedAccountId, "opaque-account");
  assert.equal(requests[0].request.google.offerToken, "buy-option");
  assert.equal(currentUser.is_premium, 0, "Dispatch promise must not grant access");
  await act(async () => { options.onPurchaseError({ code: "user-cancelled" }); });
  assert(text(root).includes("Compra cancelada"));
  assert.equal(paid, 0);
  status = "PENDING";
  await act(async () => { options.onPurchaseSuccess(purchase()); await pause(); });
  assert(text(root).includes("Pagamento pendente"));
  assert.equal(currentUser.is_premium, 0);
  failure = true;
  await act(async () => { options.onPurchaseSuccess(purchase()); await pause(); });
  assert(text(root).includes("Servidor temporariamente"));
  assert.equal(paid, 0, "Verification failure must not unlock Premium");
  failure = false; status = "PAID";
  await act(async () => { options.onPurchaseSuccess(purchase()); await pause(); });
  await settle();
  assert.equal(currentUser.is_premium, 1);
  assert.equal(paid, 1);
  purchases = [purchase()];
  await click(root, "Restaurar compra");
  assert.equal(paid, 1, "Restore must not duplicate unlock notification");
  status = "VOIDED";
  await act(async () => { resume("active"); await pause(); });
  await settle();
  assert.equal(currentUser.is_premium, 0, "Foreground refund verification must update account");
  await act(async () => root.unmount());

  purchases = [purchase("other-account")]; status = "PAID";
  root = await create();
  await click(root, "Restaurar compra");
  assert(text(root).includes("outra conta do app"));
  assert.equal(currentUser.is_premium, 0);
  await act(async () => root.unmount());

  purchases = []; status = "PAID";
  initialUser = { ...baseUser, is_premium: 1, premium_permanent: false, trial_active: true };
  root = await create();
  const paidBefore = paid;
  await act(async () => { options.onPurchaseSuccess(purchase()); await pause(); });
  await settle();
  assert.equal(currentUser.is_premium, 1);
  assert.equal(currentUser.premium_permanent, true, "Buying during trial must replace temporary access");
  assert.equal(currentUser.trial_active, false);
  assert.equal(paid, paidBefore + 1, "Trial must not suppress successful purchase notification");
  purchases = [purchase()]; status = "VOIDED";
  await act(async () => { resume("active"); await pause(); });
  await settle();
  assert.equal(currentUser.premium_permanent, false);
  assert.equal(currentUser.trial_active, true, "Refund preserves an unexpired original trial");
  assert.equal(currentUser.is_premium, 1);
  await act(async () => root.unmount());

  initialUser = baseUser;
  purchases = []; enabled = false;
  root = await create();
  assert(!button(root, "Comprar pela Google Play"));
  assert.equal(button(root, "Premium em breve").props.disabled, true, "Unavailable purchases keep a visible, disabled CTA");
  assert(text(root).includes("Compra pela Google Play em"));
  await act(async () => root.unmount());
  console.log("PASS: Android price, native checkout, cancellation, pending, verification failure, purchase, restore, refund, account isolation and disabled offer; no Asaas calls.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
