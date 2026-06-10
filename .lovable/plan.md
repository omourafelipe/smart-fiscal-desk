## Problem

In the production build the page crashes with:

```
ReferenceError: Cannot access 'Tt' before initialization
  at ode (index-BY0KqMDm.js:119:70434)   ← recharts vendor chunk
  at Hr (...)                            ← React renderWithHooks
```

`index-BY0KqMDm.js` is the vendor chunk containing **recharts**. The "Cannot access X before initialization" error in a minified vendor chunk is the textbook signature of a **circular ES module import** inside that library — the module graph is split into chunks by Vite/Rollup and one of recharts' internal `const`s is read before its declaration runs.

The project is on `recharts@^3.8.1`. Recharts 3.x has multiple open issues with exactly this symptom under Vite/Rollup production builds (the v3 rewrite introduced circular re-exports between its `state`, `chart`, and `component` barrels). Our own `src/components/ui/chart.tsx` already needs `// @ts-nocheck` to compile against v3, which is another sign we're paying the cost of v3 without using any v3-only features — the dashboard uses only the standard primitives (`BarChart`, `AreaChart`, `Bar`, `Area`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `CartesianGrid`, `PieChart`, `Pie`, `Cell`, `Legend`), all of which work identically in v2.

## Fix

Pin recharts to the last stable v2 line, which does not have this circular-init bug:

1. `bun remove recharts && bun add recharts@^2.15.0`
2. Remove the `// @ts-nocheck` from `src/components/ui/chart.tsx` (v2 ships correct types) — keep it only if a v2 type mismatch actually appears after the swap.
3. No source changes are needed in `src/routes/index.tsx` — all imported recharts symbols exist in v2 with the same API.
4. Verify in preview: hard-reload the `/` route, confirm the dashboard renders, KPI cards + bar chart + pie chart all display, and the console is clean.

## Why not other options

- **"Just retry / clear cache"** — the error is deterministic in the production bundle, not a stale-asset issue.
- **Mark recharts as `ssr.noExternal` / tweak `optimizeDeps`** — does not help; the failure is in the client production chunk, not SSR or dev pre-bundling, and the underlying circular import inside recharts v3 remains.
- **Lazy-load the charts with `React.lazy`** — would only delay the crash until the chart mounts; the broken module graph is still loaded.
- **Wait for an upstream recharts v3 fix** — unbounded; downgrading is a one-line, fully reversible change.

## Risk

Very low. v2 → v3 was mostly an internal rewrite; the public component API used in this project is unchanged. If a v2-specific type warning appears in `chart.tsx`, we keep the existing `@ts-nocheck` line.
