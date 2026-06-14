export function getColorHex(colorClass: string): string {
	const colorMap: Record<string, string> = {
		'orange-500': '#f97316',
		'blue-500': '#3b82f6',
		'green-500': '#22c55e',
		'purple-500': '#a855f7',
		'pink-500': '#ec4899',
		'yellow-500': '#eab308',
		'gray-500': '#6b7280',
		'red-500': '#ef4444'
	};
	
	for (const [key, val] of Object.entries(colorMap)) {
		if (colorClass.includes(key)) return val;
	}
	return '#6b7280'; // fallback
}
