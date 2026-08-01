<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { ArrowLeft, Landmark, TrendingUp } from '@lucide/svelte';
	import Chart from '$lib/components/Chart.svelte';
	let history = $derived(financeStore.getNetWorthHistory());
	let latest = $derived(history.at(-1));
	let first = $derived(history[0]);
	let change = $derived((latest?.netWorth ?? 0) - (first?.netWorth ?? 0));
</script>

<div class="animate-fade-in-up space-y-5"><div class="flex items-center gap-3"><a href="/" class="rounded-full p-2" style="color: var(--color-text);"><ArrowLeft size={22} /></a><div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Patrimonio neto</h1><p class="text-xs" style="color: var(--color-text-secondary);">Activos menos deudas, por cierre de mes.</p></div></div>
	<div class="rounded-2xl p-5 text-white shadow-sm" style="background: var(--gradient-header);"><p class="text-sm opacity-85">Patrimonio actual estimado</p><p class="mt-1 text-3xl font-extrabold">{financeStore.formatCurrency(latest?.netWorth ?? 0)}</p><p class="mt-2 flex items-center gap-1 text-xs opacity-85"><TrendingUp size={14} /> {change >= 0 ? '+' : ''}{financeStore.formatCurrency(change)} en los últimos 6 meses</p></div>
	<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><Chart type="line" labels={history.map((item) => item.label)} datasets={[{ label: 'Patrimonio neto', data: history.map((item) => item.netWorth), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', fill: true, tension: 0.35 }]} height={250} /></div>
	<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><h2 class="mb-3 flex items-center gap-2 font-semibold" style="color: var(--color-text);"><Landmark size={18} style="color: var(--color-primary);" /> Composición actual</h2>{#if latest}<div class="space-y-2 text-sm"><div class="flex justify-between"><span style="color: var(--color-text-secondary);">Cuentas</span><strong style="color: var(--color-text);">{financeStore.formatCurrency(latest.accounts)}</strong></div><div class="flex justify-between"><span style="color: var(--color-text-secondary);">Metas de ahorro</span><strong style="color: var(--color-success);">+{financeStore.formatCurrency(latest.savings)}</strong></div><div class="flex justify-between"><span style="color: var(--color-text-secondary);">Por cobrar</span><strong style="color: var(--color-success);">+{financeStore.formatCurrency(latest.receivables)}</strong></div><div class="flex justify-between"><span style="color: var(--color-text-secondary);">Deudas pendientes</span><strong style="color: var(--color-danger);">-{financeStore.formatCurrency(latest.debts)}</strong></div></div>{/if}</div>
	<p class="rounded-xl p-3 text-xs" style="background-color: var(--color-bg); color: var(--color-text-secondary);">La evolución se reconstruye con tus saldos iniciales y movimientos registrados. Las deudas y metas creadas desde ahora incluyen su fecha de alta para mejorar cada cierre futuro.</p>
</div>
