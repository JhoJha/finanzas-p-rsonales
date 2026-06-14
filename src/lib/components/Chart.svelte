<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	Chart.register(...registerables);

	interface Dataset {
		label: string;
		data: number[];
		backgroundColor?: string | string[];
		borderColor?: string | string[];
		borderWidth?: number;
		fill?: boolean;
		tension?: number;
	}

	let {
		type = 'doughnut' as 'doughnut' | 'line' | 'bar' | 'pie',
		labels = [] as string[],
		datasets = [] as Dataset[],
		height = 250,
		showLegend = true
	} = $props();

	let canvasEl: HTMLCanvasElement;
	let chartInstance: Chart | null = null;

	function getDefaultColors(count: number): string[] {
		const palette = [
			'#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6',
			'#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
			'#06b6d4', '#d946ef', '#eab308', '#64748b', '#ef4444'
		];
		return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
	}

	function buildChart() {
		if (!canvasEl) return;

		// Destruir instancia previa
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		// Auto-colorear si no se especificaron colores
		const finalDatasets = datasets.map((ds) => {
			const dataCount = ds.data.length;
			const colors = getDefaultColors(dataCount);
			return {
				...ds,
				backgroundColor: ds.backgroundColor || colors,
				borderColor: ds.borderColor || colors.map((c) => c.replace('0.8', '1')),
				borderWidth: ds.borderWidth || (type === 'doughnut' || type === 'pie' ? 2 : 1)
			};
		});

		const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
		const textColor = isDark ? '#94a3b8' : '#6b7280';
		const gridColor = isDark ? '#334155' : '#e5e7eb';

		chartInstance = new Chart(ctx, {
			type,
			data: {
				labels,
				datasets: finalDatasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: showLegend,
						position: 'bottom',
						labels: {
							color: textColor,
							boxWidth: 12,
							padding: 12,
							font: { size: 11 }
						}
					},
					tooltip: {
						backgroundColor: isDark ? '#1e293b' : '#ffffff',
						titleColor: isDark ? '#f1f5f9' : '#111827',
						bodyColor: isDark ? '#94a3b8' : '#6b7280',
						borderColor: isDark ? '#334155' : '#e5e7eb',
						borderWidth: 1,
						cornerRadius: 12,
						padding: 12
					}
				},
				scales: type !== 'doughnut' && type !== 'pie' ? {
					x: {
						grid: { color: gridColor },
						ticks: { color: textColor, font: { size: 10 } }
					},
					y: {
						grid: { color: gridColor },
						ticks: { color: textColor, font: { size: 10 } }
					}
				} : undefined
			}
		});
	}

	$effect(() => {
		// Reactividad: cuando cambien datos, reconstruir gráfico
		labels;
		datasets;
		type;
		if (canvasEl) {
			// pequeño delay para que el DOM se actualice
			requestAnimationFrame(() => buildChart());
		}
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
		}
	});
</script>

<div class="w-full" style="height: {height}px">
	<canvas bind:this={canvasEl}></canvas>
</div>
