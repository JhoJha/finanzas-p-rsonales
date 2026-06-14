<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Repeat } from '@lucide/svelte';

	let today = new Date();
	let currentMonth = $state(today.getMonth());
	let currentYear = $state(today.getFullYear());

	// Array of day names
	const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
	const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

	function prevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
	}

	// Agregar eventos del store
	type CalendarEvent = { id: string; type: 'expense'|'income'|'debt'|'recurring'; amount: number; title: string; date: string; };

	let allEvents = $derived(() => {
		const events: CalendarEvent[] = [];
		
		// 1. Transacciones normales
		financeStore.transactions.forEach(t => {
			if (t.type === 'transfer') return;
			events.push({
				id: t.id,
				type: t.type,
				amount: t.amount,
				title: t.note || (t.type === 'income' ? 'Ingreso' : 'Gasto'),
				date: t.date.split('T')[0]
			});
		});

		// 2. Transacciones recurrentes futuras (solo mostrar la próxima fecha)
		financeStore.recurringTransactions.forEach(rt => {
			if (rt.type === 'transfer') return;
			events.push({
				id: `rec_${rt.id}`,
				type: 'recurring',
				amount: rt.amount,
				title: rt.note || 'Recurrente',
				date: rt.nextDate.split('T')[0]
			});
		});

		// 3. Deudas pendientes
		financeStore.debts.forEach(d => {
			if (d.status === 'pending' && d.dueDate) {
				events.push({
					id: `debt_${d.id}`,
					type: 'debt',
					amount: d.totalAmount - d.paidAmount,
					title: `Deuda: ${d.contactName}`,
					date: d.dueDate.split('T')[0]
				});
			}
		});

		return events;
	});

	let calendarDays = $derived(() => {
		const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
		const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
		// Adjust for Monday start (0 = Sunday, 1 = Monday)
		const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

		const days = [];
		const eventsList = allEvents();

		for (let i = 0; i < startDay; i++) {
			days.push({ empty: true });
		}

		for (let i = 1; i <= daysInMonth; i++) {
			const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
			const dayEvents = eventsList.filter(e => e.date === dateStr);
			days.push({
				empty: false,
				dayNumber: i,
				dateStr,
				isToday: dateStr === today.toISOString().split('T')[0],
				events: dayEvents
			});
		}
		return days;
	});

	let selectedDay = $state<any>(null);
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Calendario</h1>
		<div class="flex items-center gap-3 rounded-xl p-1 shadow-sm" style="background-color: var(--color-surface);">
			<button onclick={prevMonth} class="rounded-lg p-1 transition-all active:scale-95 hover:bg-black/5" style="color: var(--color-text);"><ChevronLeft size={20} /></button>
			<span class="w-24 text-center text-sm font-bold" style="color: var(--color-text);">{monthNames[currentMonth]} {currentYear}</span>
			<button onclick={nextMonth} class="rounded-lg p-1 transition-all active:scale-95 hover:bg-black/5" style="color: var(--color-text);"><ChevronRight size={20} /></button>
		</div>
	</div>

	<p class="text-sm" style="color: var(--color-text-secondary);">
		Visualiza tus gastos, próximos cobros y vencimientos de deudas.
	</p>

	<!-- Cuadrícula del Calendario -->
	<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
		<!-- Días de la semana -->
		<div class="grid grid-cols-7 gap-1 mb-2">
			{#each weekDays as day}
				<div class="text-center text-xs font-bold" style="color: var(--color-text-secondary);">{day}</div>
			{/each}
		</div>

		<!-- Días del mes -->
		<div class="grid grid-cols-7 gap-1">
			{#each calendarDays() as day}
				{#if day.empty}
					<div class="aspect-square rounded-lg p-1 opacity-20" style="background-color: var(--color-bg);"></div>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div 
						onclick={() => day.events && day.events.length > 0 ? (selectedDay = day) : null}
						class="aspect-square cursor-pointer flex flex-col justify-between rounded-lg p-1 transition-all hover:brightness-95 active:scale-95"
						style="background-color: {day.isToday ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg)'}; border: {day.isToday ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'}; {selectedDay?.dateStr === day.dateStr ? 'box-shadow: 0 0 0 2px var(--color-primary);' : ''}"
					>
						<span class="text-xs font-bold {day.isToday ? 'text-blue-500' : ''}" style="color: {day.isToday ? 'var(--color-primary)' : 'var(--color-text)'};">
							{day.dayNumber}
						</span>
						
						{#if day.events && day.events.length > 0}
							<div class="flex flex-wrap gap-0.5 justify-end">
								{#each day.events.slice(0, 3) as event}
									<div class="h-1.5 w-1.5 rounded-full" 
										style="background-color: {event.type === 'expense' ? 'var(--color-danger)' : event.type === 'income' ? 'var(--color-success)' : event.type === 'debt' ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary)'};"
									></div>
								{/each}
								{#if day.events.length > 3}
									<div class="h-1.5 w-1.5 rounded-full" style="background-color: var(--color-text-secondary);"></div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Detalle del día seleccionado -->
	{#if selectedDay}
		<div class="animate-slide-up rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-4 text-base font-bold flex items-center gap-2" style="color: var(--color-text);">
				<CalendarIcon size={18} />
				Eventos del {selectedDay.dayNumber} de {monthNames[currentMonth]}
			</h2>

			<div class="space-y-3">
				{#each selectedDay.events as event}
					<div class="flex items-center justify-between rounded-xl p-3" style="background-color: var(--color-bg);">
						<div class="flex items-center gap-3">
							<div class="flex h-8 w-8 items-center justify-center rounded-full text-white"
								style="background-color: {event.type === 'expense' ? 'var(--color-danger)' : event.type === 'income' ? 'var(--color-success)' : event.type === 'debt' ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary)'};"
							>
								{#if event.type === 'recurring'}
									<Repeat size={14} />
								{:else if event.type === 'debt'}
									<AlertCircle size={14} />
								{:else}
									<span class="text-sm font-bold">{event.type === 'income' ? '+' : '-'}</span>
								{/if}
							</div>
							<div>
								<p class="text-sm font-semibold" style="color: var(--color-text);">{event.title}</p>
								<p class="text-xs opacity-70" style="color: var(--color-text-secondary);">
									{event.type === 'recurring' ? 'Programado' : event.type === 'debt' ? 'Vencimiento' : 'Transacción'}
								</p>
							</div>
						</div>
						<span class="font-bold text-sm" style="color: var(--color-text);">{financeStore.formatCurrency(event.amount)}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-2xl p-6 text-center text-sm shadow-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">
			Toca un día con eventos (puntos de colores) para ver el detalle.
		</div>
	{/if}

	<!-- Leyenda -->
	<div class="flex justify-center gap-4 text-xs font-medium" style="color: var(--color-text-secondary);">
		<div class="flex items-center gap-1"><div class="h-2 w-2 rounded-full" style="background-color: var(--color-success);"></div> Ingresos</div>
		<div class="flex items-center gap-1"><div class="h-2 w-2 rounded-full" style="background-color: var(--color-danger);"></div> Gastos</div>
		<div class="flex items-center gap-1"><div class="h-2 w-2 rounded-full" style="background-color: var(--color-primary);"></div> Recurrentes</div>
		<div class="flex items-center gap-1"><div class="h-2 w-2 rounded-full" style="background-color: var(--color-warning, #f59e0b);"></div> Deudas</div>
	</div>
</div>
