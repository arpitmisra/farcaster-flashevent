// Web shim for `@react-native-async-storage/async-storage`.
// Some deps (e.g. `@metamask/sdk`) reference this module even in web builds.
// In the miniapp (Next.js), we don't need RN AsyncStorage, so we provide a minimal in-memory implementation.

type Value = string | null;

const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<Value> {
    return store.has(key) ? store.get(key)! : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },
  async multiGet(keys: readonly string[]): Promise<Array<[string, Value]>> {
    return keys.map((k) => [k, store.has(k) ? store.get(k)! : null]);
  },
  async multiSet(entries: ReadonlyArray<readonly [string, string]>): Promise<void> {
    for (const [k, v] of entries) store.set(k, v);
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) store.delete(k);
  },
};

export default AsyncStorage;

