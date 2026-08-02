import { defaultCategories, type Category } from '../schema';
import { categoryCodeForLegacyId, type CategoryCode } from '$lib/domain/category-codes';

function categoryIdForCode(categories: Category[], code: CategoryCode, type: 'income' | 'expense'): string {
	return categories.find((category) => category.code === code && category.type === type)?.id
		?? categories.find((category) => categoryCodeForLegacyId(category.id) === code && category.type === type)?.id
		?? categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id
		?? (type === 'income' ? '6' : '1');
}

export function parseSpeech(text: string, categories: Category[] = defaultCategories) {
	const lowerText = text.toLowerCase();
	
	// Extraer monto
	const matchAmount = lowerText.match(/\b\d+(\.\d{1,2})?\b/);
	const amount = matchAmount ? parseFloat(matchAmount[0]) : null;

	// Determinar categoría por palabras clave
	const keywords: Record<CategoryCode, string[]> = {
		food: ['comida', 'almuerzo', 'desayuno', 'cena', 'restaurante', 'pizza', 'hamburguesa', 'supermercado'],
		transport: ['pasaje', 'taxi', 'transporte', 'bus', 'gasolina', 'uber', 'tren'],
		housing: ['alquiler', 'luz', 'agua', 'internet', 'casa', 'mantenimiento'],
		education: ['colegio', 'universidad', 'curso', 'libro', 'cuaderno', 'pensión'],
		entertainment: ['cine', 'juego', 'salida', 'cerveza', 'fiesta', 'ocio', 'entretenimiento'],
		income: [],
		debt_payment: [],
		savings: []
	};

	let categoryCode: CategoryCode = 'food';
	let type: 'income' | 'expense' = 'expense'; // Por detectar gastos más comúnmente en dictado

	if (lowerText.includes('ingresé') || lowerText.includes('gané') || lowerText.includes('sueldo') || lowerText.includes('pago de')) {
		type = 'income';
		categoryCode = 'income';
	} else {
		for (const [code, words] of Object.entries(keywords) as [CategoryCode, string[]][]) {
			if (words.some((word) => lowerText.includes(word))) {
				categoryCode = code;
				break;
			}
		}
	}

	return {
		amount,
		categoryCode,
		categoryId: categoryIdForCode(categories, categoryCode, type),
		type,
		note: text
	};
}
