export function invariant<T>(
  condition: T | "" | false | null | undefined,
  message: string,
): T {
  if (condition) return condition;
  throw new Error(message);
}

export function groupWith<Output, Input, Key extends keyof any>(
  valTransform: (prev: undefined | Output, value: Input) => Output,
  keyMaker: (o: Input) => Key,
  values: Array<Input>,
) {
  const result = {} as Record<Key, Output>;
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;
    const key = keyMaker(val);
    result[key] = valTransform(result[key], val);
  }
  return result;
}

export function groupBy<T, K extends string>(
  keyMaker: (a: T) => K,
  values: Array<T>,
): Record<K, Array<T>> {
  return groupWith(
    (b, a) => {
      const r = b ?? [];
      r.push(a);
      return r;
    },
    keyMaker,
    values,
  );
}
