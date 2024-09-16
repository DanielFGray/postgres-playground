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

export function zip<A, B>(a: Array<A>, b: Array<B>) {
  const result: [A, B][] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    result.push([a[i], b[i]]);
  }
  return result;
}

export function randomNumber(max: number): number
export function randomNumber(min: number, max: number): number
export function randomNumber(min: number, max?: number): number {
  if (!max) [min, max] = [0, min]
  if (min > max) [min, max] = [max, min];
  return Math.floor(min + Math.random() * (max - min));
}

export function generateStr(
  length: number,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
) {
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomNumber(charactersLength));
  }
  return result;
}

/**
 * silly hack to enable syntax highlighting
 */
export function templateHack(
// export function templateHack<T extends string | number | boolean | { toString(): string }>(
  strings: TemplateStringsArray,
  // ...interpolations: Array<T>
) {
  return strings.join("");
  // let result = "";
  // for (let i = 0; i < strings.length; i++) {
  //   result += strings[i];
  //   if (i < interpolations.length) {
  //     result += interpolations[i];
  //   }
  // }
  // return result;
}

export function throttle<R, A extends any[]>(
  fn: (...args: A) => R,
  delay: number,
): [(...args: A) => R | undefined, () => void] {
  let wait = false;
  let timeout: undefined | number;
  let cancelled = false;

  return [
    function throttledFunction(...args: A) {
      if (cancelled) return undefined;
      if (wait) return undefined;

      const val = fn(...args);

      wait = true;

      timeout = window.setTimeout(() => {
        wait = false;
      }, delay);

      return val;
    },
    () => {
      cancelled = true;
      clearTimeout(timeout);
    },
  ];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(min = 100, max = 600) {
  return sleep(Math.ceil(randomNumber(min, max)));
}
