
export function fail(msg: string): never {
  throw new Error(msg);
}

export function assert(test: boolean) {
  if (!test) fail("assertion failed");
}

export const Obj = {
  /** Like `Object.entries` but preserving more type information */
  entries: <K extends string | number | symbol, V>(obj: Record<K, V>) =>
    Object.entries(obj) as [K, V][],

  /** Like `Object.keys` but preserving more type information */
  keys: <K extends string | number | symbol>(obj: Record<K, any>) =>
    Object.keys(obj) as K[],

  /** Like `Object.values` but preserving more type information */
  values: <V>(obj: Record<any, V>) =>
    Object.values(obj) as V[],
};
