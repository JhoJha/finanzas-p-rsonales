import { defaultCategories } from '../schema';

export function parseSpeech(text: string) {
	const lowerText = text.toLowerCase();
	
	// Extraer monto
	const matchAmount = lowerText.match(/\b\d+(\.\d{1,2})?\b/);
	const amount = matchAmount ? parseFloat(matchAmount[0]) : null;

	// Determinar categoría por palabras clave
	const keywords: Record<string, string[]> = {
		'1': ['comida', 'almuerzo', 'desayuno', 'cena', 'restaurante', 'pizza', 'hamburguesa', 'supermercado'], // Alimentación
		'2': ['pasaje', 'taxi', 'transporte', 'bus', 'gasolina', 'uber', 'tren'], // Transporte
		'3': ['alquiler', 'luz', 'agua', 'internet', 'casa', 'mantenimiento'], // Vivienda
		'4': ['colegio', 'universidad', 'curso', 'libro', 'cuaderno', 'pensión'], // Educación
		'5': ['cine', 'juego', 'salida', 'cerveza', 'fiesta', 'ocio', 'entretenimiento'], // Ocio
	};

	let categoryId = '1'; // Default: Alimentación
	let type: 'income' | 'expense' = 'expense'; // Por detectar gastos más comúnmente en dictado

	if (lowerText.includes('ingresé') || lowerText.includes('gané') || lowerText.includes('sueldo') || lowerText.includes('pago de')) {
		type = 'income';
		categoryId = '6'; // Trabajo / Ingresos
	} else {
		for (const [id, words] of Object.entries(keywords)) {
			if (words.some((word) => lowerText.includes(word))) {
				categoryId = id;
				break;
			}
		}
	}

	return {
		amount,
		categoryId,
		type,
		note: text
	};
}