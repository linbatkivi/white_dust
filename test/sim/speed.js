// Forhåndsindlæst i testserveren (node -r): spoler spiltiden frem ×SIMK, så bot-runder kan køres hurtigt.
// performance.now() ganges, og timere forkortes tilsvarende – serverens dt pr. tick forbliver ~33 ms.
const K = +process.env.SIMK || 1; if (K !== 1) {
  const base = performance.now.bind(performance); const t0 = base();
  Object.defineProperty(globalThis, 'performance', { value: { now: () => t0 + (base() - t0) * K, timeOrigin: performance.timeOrigin, mark() {}, measure() {} }, configurable: true });
  const si = global.setInterval, st = global.setTimeout;
  global.setInterval = (f, ms, ...a) => si(f, ms / K, ...a); global.setTimeout = (f, ms, ...a) => st(f, ms / K, ...a);
}
