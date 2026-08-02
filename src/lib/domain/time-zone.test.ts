import { describe, expect, it } from 'vitest';
import { AiRequestSchema } from '$lib/contracts/api';
import { SettingsSchema } from '$lib/schema';

describe('validación compartida de zona horaria', () => {
	it('acepta zonas IANA y rechaza valores que romperían Intl', () => {
		expect(SettingsSchema.safeParse({ locale: 'es-PE', timeZone: 'America/Lima', baseCurrency: 'PEN', exchangeRates: {} }).success).toBe(true);
		expect(SettingsSchema.safeParse({ locale: 'es-PE', timeZone: 'not/a-time-zone', baseCurrency: 'PEN', exchangeRates: {} }).success).toBe(false);
		expect(AiRequestSchema.safeParse({ source: 'voice', text: 'test', locale: 'en-US', timeZone: 'not/a-time-zone', currency: 'USD' }).success).toBe(false);
	});
});
