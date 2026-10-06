<script>
  import { formatShort } from '../lib/dates.js';

  let { tests } = $props();

  const W = 320, H = 160, PAD = { l: 34, r: 12, t: 12, b: 26 };

  const chart = $derived.by(() => {
    if (tests.length === 0) return null;
    const max = Math.max(10, ...tests.map((t) => t.seconds)) * 1.15;
    const n = tests.length;
    const x = (i) => (n === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r));
    const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
    const points = tests.map((t, i) => ({ x: x(i), y: y(t.seconds), t }));
    const step = max > 60 ? 20 : max > 30 ? 10 : 5;
    const ticks = [];
    for (let v = 0; v <= max; v += step) ticks.push({ v, y: y(v) });
    return { points, ticks, path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') };
  });
</script>

{#if chart}
  <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Hollow hold results over time">
    {#each chart.ticks as tick}
      <line x1={PAD.l} x2={W - PAD.r} y1={tick.y} y2={tick.y} class="stroke-base-300" stroke-width="1" />
      <text x={PAD.l - 6} y={tick.y + 4} text-anchor="end" class="fill-current text-[10px] opacity-60">{tick.v}s</text>
    {/each}
    <path d={chart.path} fill="none" class="stroke-primary" stroke-width="2.5" stroke-linejoin="round" />
    {#each chart.points as p, i}
      <circle cx={p.x} cy={p.y} r="4" class="fill-primary" />
      {#if i === 0 || i === chart.points.length - 1}
        <text x={p.x} y={H - 8} text-anchor={chart.points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} class="fill-current text-[10px] opacity-60">
          {formatShort(p.t.date)}
        </text>
      {/if}
    {/each}
  </svg>
{:else}
  <p class="opacity-60">No tests yet.</p>
{/if}
