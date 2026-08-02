<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { categoryDisplayName } from '$lib/i18n';
	import { subscriptionMerchantName } from '$lib/utils/forecast';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { ArrowLeft, BellRing, CalendarDays, CreditCard, Repeat2, TrendingUp } from '@lucide/svelte';

	let subscriptions = $derived(financeStore.getDetectedSubscriptions());
	let totalMonthly = $derived(subscriptions.reduce((total, item) => total + item.monthlyCost, 0));
	let totalAnnual = $derived(subscriptions.reduce((total, item) => total + item.annualCost, 0));
	let subscriptionCategoryId = $derived(financeStore.categories.find((category) => category.code === 'subscriptions' && category.type === 'expense')?.id);
	function date(value: Date) { return value.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }); }
	function categoryName(id: string) { return categoryDisplayName(financeStore.categories.find((category) => category.id === id), financeStore.settings.locale); }
	function classifyAsSubscription(subscription: typeof subscriptions[number]) {
		if (!subscriptionCategoryId) return;
		const candidates = financeStore.transactions.filter((transaction) => transaction.type === 'expense'
			&& transaction.accountId === subscription.accountId
			&& subscriptionMerchantName(transaction.note, transaction.categoryId) === subscription.merchant
			&& transaction.categoryId !== subscriptionCategoryId);
		let updated = 0;
		for (const transaction of candidates) if (financeStore.updateTransaction(transaction.id, { categoryId: subscriptionCategoryId })) updated += 1;
		if (!updated) return;
		vibrate(15);
		toastStore.add(`${updated} cobro${updated === 1 ? '' : 's'} clasificado${updated === 1 ? '' : 's'} como suscripción.`, 'success');
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-3"><a href="/" class="rounded-full p-2" style="color: var(--color-text);"><ArrowLeft size={22} /></a><div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Suscripciones</h1><p class="text-xs" style="color: var(--color-text-secondary);">Pagos repetidos detectados automáticamente.</p></div></div>

	{#if subscriptions.length > 0}
		<div class="rounded-2xl p-5 text-white shadow-sm" style="background: var(--gradient-header);"><div class="flex items-center justify-between"><div><p class="text-sm opacity-80">Costo estimado</p><p class="mt-1 text-3xl font-extrabold">{financeStore.formatCurrency(totalMonthly)}<span class="text-sm font-medium"> / mes</span></p><p class="mt-1 text-xs opacity-75">{financeStore.formatCurrency(totalAnnual)} al año</p></div><Repeat2 size={34} class="opacity-80" /></div></div>
		<div class="space-y-3">
			{#each subscriptions as subscription}
				<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
					<div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate font-bold" style="color: var(--color-text);">{subscription.merchant}</p><p class="mt-1 text-xs" style="color: var(--color-text-secondary);">{categoryName(subscription.categoryId)} · {subscription.occurrences} cobros detectados</p></div><span class="whitespace-nowrap text-sm font-bold" style="color: var(--color-danger);">{financeStore.formatCurrency(subscription.monthlyCost)} / mes</span></div>
					<div class="mt-3 flex items-center justify-between rounded-xl p-2.5 text-xs" style="background-color: var(--color-bg); color: var(--color-text-secondary);"><span class="flex items-center gap-1"><CalendarDays size={14} /> Próximo: {date(subscription.nextDate)}</span><span class="flex items-center gap-1"><CreditCard size={14} /> {financeStore.formatCurrency(subscription.annualCost)} / año</span></div>
					{#if subscriptionCategoryId && subscription.categoryId !== subscriptionCategoryId}
						<div class="mt-3 rounded-xl p-3" style="background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg));">
							<p class="text-xs" style="color: var(--color-text);">Sugerencia: clasifica estos cobros repetidos como <strong>Suscripciones</strong>.</p>
							<button onclick={() => classifyAsSubscription(subscription)} class="mt-2 rounded-lg px-3 py-2 text-xs font-bold text-white" style="background-color: var(--color-primary);">Clasificar {subscription.occurrences} cobros</button>
						</div>
					{/if}
					{#if subscription.changePercent >= 5}<p class="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-600"><TrendingUp size={14} /> El último cobro aumentó {subscription.changePercent}% frente a los anteriores.</p>{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="rounded-2xl p-8 text-center shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><BellRing class="mx-auto mb-3" size={42} style="color: var(--color-primary);" /><h2 class="font-semibold" style="color: var(--color-text);">Aún no detectamos suscripciones</h2><p class="mt-2 text-sm" style="color: var(--color-text-secondary);">Registra al menos tres pagos similares, con frecuencia semanal, quincenal o mensual.</p><a href="/registro" class="mt-5 inline-block rounded-xl px-4 py-2.5 text-sm font-bold text-white" style="background-color: var(--color-primary);">Registrar movimiento</a></div>
	{/if}
</div>
