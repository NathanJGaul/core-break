<script>
  import { localDate, addDays, weekStart, formatShort } from '../lib/dates.js';

  let { counts, weeks = 16 } = $props();

  const today = localDate();
  const firstDay = $derived(addDays(weekStart(today), -(weeks - 1) * 7));

  const columns = $derived(
    Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(firstDay, w * 7 + d);
        return { date, count: date > today ? null : (counts.get(date) ?? 0) };
      })
    )
  );

  function level(n) {
    if (n == null) return 'opacity-0';
    if (n === 0) return 'bg-base-300';
    if (n <= 2) return 'bg-primary/35';
    if (n <= 4) return 'bg-primary/65';
    return 'bg-primary';
  }
</script>

<div class="overflow-x-auto">
  <div class="flex gap-[3px]" role="img" aria-label="Sessions per day over the last {weeks} weeks">
    {#each columns as col}
      <div class="flex flex-col gap-[3px]">
        {#each col as cell}
          <span
            class={['size-3.5 rounded-[3px]', level(cell.count)]}
            title={cell.count == null ? '' : `${formatShort(cell.date)}: ${cell.count} ${cell.count === 1 ? 'session' : 'sessions'}`}
          ></span>
        {/each}
      </div>
    {/each}
  </div>
</div>
<div class="mt-2 flex items-center gap-2 text-xs opacity-60">
  <span>{formatShort(firstDay)}</span>
  <span class="flex-1"></span>
  <span>0</span>
  <span class="size-3 rounded-[3px] bg-base-300"></span>
  <span class="size-3 rounded-[3px] bg-primary/35"></span>
  <span class="size-3 rounded-[3px] bg-primary/65"></span>
  <span class="size-3 rounded-[3px] bg-primary"></span>
  <span>5+</span>
</div>
