
export function fail(msg: string): never {
  throw new Error(msg);
}

export function assert(test: boolean) {
  if (!test) fail("assertion failed");
}
