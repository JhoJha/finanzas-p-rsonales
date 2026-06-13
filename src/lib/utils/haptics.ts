export function vibrate(pattern: number | number[] = 15) {
	if (typeof window !== 'undefined' && navigator && navigator.vibrate) {
		try {
			navigator.vibrate(pattern);
		} catch (e) {
			// Ignore gracefully if not supported or blocked
		}
	}
}
