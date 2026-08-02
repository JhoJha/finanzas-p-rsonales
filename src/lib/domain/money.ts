/** Conversión determinista para contratos nuevos, sin reinterpretar datos históricos. */
export function currencyFractionDigits(currency: string): number {
	try {
		return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
	} catch {
		return 2;
	}
}

export function toMinorUnits(amount: number, currency: string): number {
	if (!Number.isFinite(amount)) throw new Error('El monto debe ser finito.');
	const value = Math.round(amount * 10 ** currencyFractionDigits(currency));
	if (!Number.isSafeInteger(value)) throw new Error('El monto excede el rango seguro.');
	return value;
}

export function fromMinorUnits(amountMinor: number, currency: string): number {
	if (!Number.isSafeInteger(amountMinor)) throw new Error('Las unidades menores deben ser un entero seguro.');
	return amountMinor / 10 ** currencyFractionDigits(currency);
}
