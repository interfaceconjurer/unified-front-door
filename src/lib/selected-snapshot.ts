/** Cache a selected external-store snapshot independently of React rendering. */
export function selectedSnapshot<T, S>(read: () => T, select: (value: T) => S, equal: (a: S, b: S) => boolean = Object.is): () => S {
  let previous: T, selected: S, initialized = false;
  return () => {
    const next = read();
    if (!initialized || next !== previous) {
      const value = select(next);
      if (!initialized || !equal(selected, value)) selected = value;
      previous = next; initialized = true;
    }
    return selected;
  };
}
