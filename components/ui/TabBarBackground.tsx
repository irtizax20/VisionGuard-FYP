// This is a shim for web and Android where the tab bar is generally opaque.
export default undefined;
// No-op hook for bottom tab overflow on platforms that do not support it.
export function useBottomTabOverflow() {
  return 0;
}
