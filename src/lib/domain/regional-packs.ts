import type { CategoryCode } from '$lib/domain/category-codes';

export const REGIONAL_PACK_IDS = ['pe', 'mx', 'es', 'us'] as const;
export type RegionalPackId = (typeof REGIONAL_PACK_IDS)[number];

export const REGIONAL_PACKS: Record<RegionalPackId, { label: string; keywords: Partial<Record<CategoryCode, readonly string[]>> }> = {
	pe: { label: 'Perú', keywords: { food: ['cuates', 'palta', 'bodega'], transport: ['mototaxi', 'combi', 'pasaje'], taxes: ['sunat'], fees: ['yape', 'plin'] } },
	mx: { label: 'México', keywords: { food: ['antojitos', 'tacos', 'abarrotes'], transport: ['pesero', 'metrobus'], taxes: ['sat'] } },
	es: { label: 'España', keywords: { food: ['mercadona', 'bocadillo'], transport: ['metro', 'renfe'], taxes: ['hacienda'] } },
	us: { label: 'Estados Unidos', keywords: { food: ['walmart', 'groceries'], transport: ['gas station', 'rideshare'], taxes: ['irs'] } }
};

/** Las reglas personales se aplican después y, por ello, tienen prioridad sobre estos paquetes. */
export function regionalCategoryMatch(text: string, packs: RegionalPackId[]): { code: CategoryCode; keyword: string } | null {
	const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	for (const pack of packs) for (const [code, keywords] of Object.entries(REGIONAL_PACKS[pack].keywords) as [CategoryCode, readonly string[]][]) {
		const keyword = keywords.find((item) => normalized.includes(item));
		if (keyword) return { code, keyword };
	}
	return null;
}
