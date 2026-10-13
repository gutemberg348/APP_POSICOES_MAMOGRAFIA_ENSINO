// Simulated native geometry/events, without building an APK or opening a keyboard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map();
let visible = false, keyboardTop = 480, viewportHeight = 390, scrollY = 0, focused = true;
let inputContentY = 820, result, root;
const scrollCalls = [];
const input = {
  isFocused: () => focused,
  measureInWindow: (cb) => cb(24, 90 + inputContentY - scrollY, 300, 52),
};
const scrollRef = { current: {
  getNativeScrollRef: () => ({ measureInWindow: (cb) => cb(0, 90, 390, viewportHeight) }),
  scrollTo: ({ y }) => { scrollY = y; scrollCalls.push(y); result.onScroll({ nativeEvent: { contentOffset: { y } } }); },
} };
const moduleResult = { exports: {} };
const filename = path.resolve(__dirname, '../src/useAuthKeyboard.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: moduleResult.exports, setTimeout, clearTimeout,
  require(name) {
    if (name === 'react-native') return {
      Platform: { OS: 'android' },
      Keyboard: { isVisible: () => visible, metrics: () => visible ? { screenY: keyboardTop } : undefined,
        addListener: (name, fn) => { listeners.set(name, fn); return { remove: () => listeners.delete(name) }; } },
    };
    return require(name);
  },
}, { filename });
function Host() { result = moduleResult.exports.default(scrollRef, true); return null; }
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 150)));
function assertCentered() {
  const inputCenter = 90 + inputContentY - scrollY + 26;
  const availableBottom = Math.min(90 + viewportHeight, keyboardTop);
  assert(Math.abs(inputCenter - (90 + availableBottom) / 2) < 2, 'Field should be centered above the keyboard');
  assert(inputCenter + 26 < keyboardTop - 60, 'Field needs breathing room above the keyboard');
}
(async () => {
  await act(() => { root = create(React.createElement(Host)); });
  result.onFocus(input);
  await settle();
  assert.equal(scrollCalls.length, 0, 'Do not jump before keyboard opens');
  visible = true;
  await act(() => { listeners.get('keyboardDidShow')(); result.onLayout(viewportHeight); });
  await settle();
  assertCentered();
  assert(result.bottomSpace >= viewportHeight / 2, 'Last field must have room to scroll up');
  // Next field while the same keyboard stays open.
  inputContentY = 920;
  result.onFocus(input);
  await settle();
  assertCentered();
  // Taller keyboard / password suggestion strip and resized window.
  keyboardTop = 400; viewportHeight = 310;
  await act(() => { result.onLayout(viewportHeight); });
  await settle();
  assertCentered();
  // An overlaying keyboard is also bounded, even before adjustResize completes.
  viewportHeight = 740;
  await act(() => { result.onLayout(viewportHeight); });
  await settle();
  assertCentered();
  const previousCalls = scrollCalls.length;
  focused = false;
  result.onFocus(input);
  await settle();
  assert.equal(scrollCalls.length, previousCalls, 'Ignore fields that lost focus');
  visible = false;
  await act(() => { listeners.get('keyboardDidHide')(); });
  assert.equal(result.bottomSpace, 0, 'Remove extra space after dismissal');
  await act(() => root.unmount());
  assert.equal(listeners.size, 0, 'Remove event listeners');
  console.log('PASS: centered fields after keyboard open, field switch, resize and overlay; blur, dismissal and cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
