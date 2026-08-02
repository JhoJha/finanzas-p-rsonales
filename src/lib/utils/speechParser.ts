import { defaultCategories, type Category, type PersonalClassificationRule } from '../schema';
import { categoryCodeForLegacyId, type CategoryCode } from '$lib/domain/category-codes';
import { dateFromDateOnly, formatDateOnly } from '$lib/utils/date';
import { findLearnedRule } from '$lib/domain/classification-rules';
import { regionalCategoryMatch, type RegionalPackId } from '$lib/domain/regional-packs';

export type SpeechReviewReason = 'type' | 'category';

export type SpeechTransactionDraft = {
	id: string;
	amount: number;
	categoryCode: CategoryCode | 'custom';
	categoryId: string;
	type: 'income' | 'expense';
	note: string;
	date: string;
	reviewReasons: SpeechReviewReason[];
	subcategory?: string;
	merchant?: string;
	location?: string;
	counterparty?: string;
	incomeSource?: 'salary' | 'sales' | 'gift' | 'refund' | 'loan' | 'client' | 'other';
	explanation: string[];
	learnRule?: boolean;
};

type ParserLocale = 'es-PE' | 'en-US';
type ActionType = 'income' | 'expense';

const MONEY_NUMBER = /(?<!\d)(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/g;
const CURRENCY_AFTER = /^\s*(?:s\/?\.?|sol(?:es)?|pen|\$|usd|dollars?)\b/i;
const CURRENCY_BEFORE = /(?:s\/?\.?|pen|\$|usd)\s*$/i;
const CONTINUATION_DETAIL = /^\s*(?:en|para|de|por|on|for|at|in)\b/i;
const SPANISH_NUMBER_SEQUENCE = /\b(?:cero|un(?:o|a)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti(?:uno|una|[úu]n|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|mill[oó]n(?:es)?|y|con|coma|punto)(?:\s+(?:cero|un(?:o|a)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti(?:uno|una|[úu]n|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|mill[oó]n(?:es)?|y|con|coma|punto))*\b/giu;
const ENGLISH_NUMBER_SEQUENCE = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|and|point|dot|comma)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|and|point|dot|comma))*\b/giu;

const numberValues: Record<ParserLocale, Record<string, number>> = {
	'es-PE': {
		cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
		diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
		veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
		treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
		cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900
	},
	'en-US': {
		zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
		ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
		twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
	}
};

const language = {
	'es-PE': {
		income: ['ingrese', 'gane', 'recibi', 'cobre', 'me pagaron', 'me dio', 'me dieron', 'me regalo', 'sueldo', 'salario', 'venta'],
		expense: ['gaste', 'pague', 'compre', 'costo', 'debite'],
		yesterday: ['ayer'],
		categories: {
			food: ['comida', 'almuerzo', 'desayuno', 'cena', 'restaurante', 'pizza', 'hamburguesa', 'supermercado', 'mercado', 'cafe', 'pan', 'queso', 'helado', 'panaderia', 'palta', 'cuates', 'alita broaster'],
			transport: ['pasaje', 'pasajes', 'taxi', 'transporte', 'bus', 'gasolina', 'uber', 'tren', 'metro', 'moto', 'mototaxi'],
			housing: ['alquiler', 'luz', 'agua', 'internet', 'casa', 'mantenimiento', 'hotel', 'hospedaje'],
			education: ['colegio', 'universidad', 'curso', 'libro', 'cuaderno', 'pension'],
			entertainment: ['cine', 'juego', 'salida', 'cerveza', 'fiesta', 'ocio', 'entretenimiento'],
			subscriptions: ['netflix', 'spotify', 'chatgpt', 'openai', 'youtube premium', 'disney', 'hbo', 'amazon prime', 'prime video'],
			health: ['medicina', 'medicamento', 'farmacia', 'doctor', 'consulta', 'dental', 'hospital'],
			personal_care: ['perfume', 'shampoo', 'barberia', 'peluqueria', 'maquillaje', 'cosmetico'],
			clothing: ['ropa', 'polo', 'camisa', 'zapatilla', 'zapato', 'pantalon'],
			gifts_family: ['regalo', 'familia', 'cumpleanos'],
			pets: ['mascota', 'perro', 'gato', 'veterinaria', 'croquetas'],
			taxes: ['impuesto', 'sunat', 'tributo'],
			fees: ['comision', 'mantenimiento bancario'],
			business: ['portaminas', 'oficina', 'cliente', 'proveedor', 'negocio']
		}
	},
	'en-US': {
		income: ['received', 'earned', 'got paid', 'was given', 'gifted', 'salary', 'paycheck', 'sold'],
		expense: ['spent', 'paid', 'bought', 'cost', 'charged'],
		yesterday: ['yesterday'],
		categories: {
			food: ['food', 'lunch', 'breakfast', 'dinner', 'restaurant', 'pizza', 'hamburger', 'groceries', 'coffee'],
			transport: ['fare', 'ticket', 'taxi', 'transport', 'bus', 'gas', 'uber', 'train', 'subway'],
			housing: ['rent', 'electricity', 'water', 'internet', 'home', 'maintenance', 'hotel', 'lodging'],
			education: ['school', 'university', 'course', 'book', 'notebook', 'tuition'],
			entertainment: ['movie', 'game', 'outing', 'beer', 'party', 'leisure', 'entertainment'],
			subscriptions: ['netflix', 'spotify', 'chatgpt', 'openai', 'youtube premium', 'disney', 'hbo', 'amazon prime', 'prime video'],
			health: ['medicine', 'pharmacy', 'doctor', 'hospital', 'dentist'],
			personal_care: ['perfume', 'shampoo', 'barber', 'makeup', 'cosmetic'],
			clothing: ['clothes', 'shirt', 'shoes', 'pants'],
			gifts_family: ['gift', 'family', 'birthday'],
			pets: ['pet', 'dog', 'cat', 'vet'],
			taxes: ['tax', 'irs'],
			fees: ['fee', 'commission'],
			business: ['office', 'client', 'supplier', 'business']
		}
	}
} as const;

function categoryIdForCode(categories: Category[], code: CategoryCode, type: ActionType): string {
	return categories.find((category) => category.code === code && category.type === type)?.id
		?? categories.find((category) => categoryCodeForLegacyId(category.id) === code && category.type === type)?.id
		?? (code === 'uncategorized' ? '7' : code === 'subscriptions' ? '8' : undefined)
		?? categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id
		?? (type === 'income' ? '6' : '7');
}

function normalized(value: string): string {
	return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function lastActionIn(text: string, locale: ParserLocale): ActionType | null {
	const value = normalized(text);
	let lastIncome = -1;
	let lastExpense = -1;
	for (const phrase of language[locale].income) lastIncome = Math.max(lastIncome, value.lastIndexOf(phrase));
	for (const phrase of language[locale].expense) lastExpense = Math.max(lastExpense, value.lastIndexOf(phrase));
	if (lastIncome < 0 && lastExpense < 0) return null;
	return lastIncome > lastExpense ? 'income' : 'expense';
}

function categoryMatchForText(text: string, type: ActionType, locale: ParserLocale): { code: CategoryCode; keyword: string } | null {
	if (type === 'income') return { code: 'income', keyword: locale === 'es-PE' ? 'ingreso' : 'income' };
	const value = normalized(text);
	for (const [code, keywords] of Object.entries(language[locale].categories) as [Exclude<CategoryCode, 'income' | 'debt_payment' | 'savings' | 'uncategorized'>, readonly string[]][]) {
		const keyword = keywords.find((item) => new RegExp(`(?:^|[^a-z0-9])${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(value));
		if (keyword) return { code, keyword };
	}
	return null;
}

function categoryCodeForText(text: string, type: ActionType, locale: ParserLocale): CategoryCode | null {
	const match = categoryMatchForText(text, type, locale);
	return match?.code ?? null;
}

function titleCase(value: string): string {
	return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function merchantForText(text: string, locale: ParserLocale): string | undefined {
	const source = text.replace(/\s+/g, ' ').trim();
	const match = locale === 'es-PE'
		? /\b(?:en|del|de la)\s+(?:el |la )?([\p{L}\d][\p{L}\d .'-]{1,70}?)(?=$|[,.;])/iu.exec(source)
		: /\b(?:at|from)\s+(?:the )?([\p{L}\d][\p{L}\d .'-]{1,70}?)(?=$|[,.;])/iu.exec(source);
	if (!match) return undefined;
	const candidate = match[1].replace(/\b(?:para|por|for)\b.*$/iu, '').trim();
	const knownMerchant = /^(?:cineplanet|netflix|spotify|chatgpt|amazon|la mechita)$/iu.test(candidate);
	return candidate.length >= 2 && (knownMerchant || /\p{Lu}/u.test(match[1])) ? titleCase(candidate) : undefined;
}

function counterpartyForText(text: string, locale: ParserLocale): string | undefined {
	const match = locale === 'es-PE'
		? /\b(?:mi\s+)?([\p{L}][\p{L}'-]{1,40})\s+me\s+(?:dio|dieron|pago|pag[oó])/iu.exec(text)
		: /\b(?:my\s+)?([\p{L}][\p{L}'-]{1,40})\s+(?:gave|paid)\s+me\b/iu.exec(text);
	return match ? titleCase(match[1]) : undefined;
}

function subcategoryForText(text: string, code: CategoryCode): string | undefined {
	const value = normalized(text);
	if (code === 'food') {
		if (/(pan|panaderia)/.test(value)) return 'Panadería';
		if (/(restaurante|pizza|hamburguesa|alita broaster)/.test(value)) return 'Restaurante';
		if (/(supermercado|mercado|bodega)/.test(value)) return 'Supermercado';
	}
	return undefined;
}

function incomeSourceForText(text: string, locale: ParserLocale): SpeechTransactionDraft['incomeSource'] | undefined {
	const value = normalized(text);
	if (/(sueldo|salario|paycheck|salary)/.test(value)) return 'salary';
	if (/(venta|vend[ií]|sold|sale)/.test(value)) return 'sales';
	if (/(devolucion|reembolso|refund)/.test(value)) return 'refund';
	if (/(prestamo|loan)/.test(value)) return 'loan';
	if (/(cliente|client)/.test(value)) return 'client';
	if (/(regalo|propina|me dio|was given|gift)/.test(value)) return 'gift';
	return locale === 'es-PE' ? 'other' : 'other';
}

function dateForText(text: string, defaultDate: string, locale: ParserLocale): string {
	if (!language[locale].yesterday.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(text))) return defaultDate;
	const yesterday = dateFromDateOnly(defaultDate);
	yesterday.setDate(yesterday.getDate() - 1);
	return formatDateOnly(yesterday);
}

function parseLocalizedAmount(raw: string): number | null {
	const lastComma = raw.lastIndexOf(',');
	const lastDot = raw.lastIndexOf('.');
	let normalizedAmount = raw;
	if (lastComma >= 0 && lastDot >= 0) {
		const decimal = lastComma > lastDot ? ',' : '.';
		normalizedAmount = raw.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.');
	} else if (lastComma >= 0 || lastDot >= 0) {
		const separator = lastComma >= 0 ? ',' : '.';
		const trailing = raw.length - raw.lastIndexOf(separator) - 1;
		normalizedAmount = trailing === 3 ? raw.replace(/[.,]/g, '') : raw.replace(',', '.');
	}
	const amount = Number(normalizedAmount);
	return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseSpokenInteger(words: string[], locale: ParserLocale): number | null {
	let total = 0;
	let current = 0;
	let foundNumber = false;
	for (const word of words) {
		if (word === 'y' || word === 'and') continue;
		if (word === 'mil' || word === 'thousand') {
			total += (current || 1) * 1_000;
			current = 0;
			foundNumber = true;
			continue;
		}
		if (word === 'millon' || word === 'millones' || word === 'million') {
			total += (current || 1) * 1_000_000;
			current = 0;
			foundNumber = true;
			continue;
		}
		if (word === 'hundred') {
			current = (current || 1) * 100;
			foundNumber = true;
			continue;
		}
		const value = numberValues[locale][word];
		if (value === undefined) return null;
		current += value;
		foundNumber = true;
	}
	return foundNumber ? total + current : null;
}

function parseSpokenAmount(value: string, locale: ParserLocale): number | null {
	const words = normalized(value).split(/[\s-]+/).filter(Boolean);
	const markerIndex = words.findIndex((word) => ['con', 'coma', 'punto', 'point', 'dot'].includes(word));
	const integerWords = markerIndex >= 0 ? words.slice(0, markerIndex) : words;
	const integer = parseSpokenInteger(integerWords, locale);
	if (integer === null) return null;
	if (markerIndex < 0) return integer;
	const decimalWords = words.slice(markerIndex + 1);
	const digits = decimalWords.map((word) => numberValues[locale][word]).filter((digit): digit is number => digit !== undefined && digit >= 0 && digit <= 9);
	const fractionText = digits.length === decimalWords.length ? digits.join('') : String(parseSpokenInteger(decimalWords, locale) ?? '');
	const fraction = Number(fractionText);
	if (!fractionText || !Number.isInteger(fraction) || fraction < 0 || fraction >= 100) return null;
	return Number(`${integer}.${fractionText}`);
}

/** Convierte palabras numéricas a dígitos antes de aplicar las mismas reglas de contexto monetario. */
function replaceSpokenAmounts(text: string, locale: ParserLocale): string {
	const expression = locale === 'es-PE' ? SPANISH_NUMBER_SEQUENCE : ENGLISH_NUMBER_SEQUENCE;
	return text.replace(expression, (candidate) => {
		const amount = parseSpokenAmount(candidate, locale);
		return amount === null ? candidate : String(amount);
	});
}

function noteForSegment(segment: string, fullText: string): string {
	const note = segment
		.replace(CURRENCY_AFTER, '')
		.replace(/^\s*(?:en|para|de|on|for|at|in)\s+/i, '')
		.replace(/\s*,\s*(?:me\s+)?(?:compr[ée]|gast[ée]|pagu[ée]|recib[íi]).*$/i, '')
		.replace(/\s*,\s*luego\s+.*?me\s+dio(?:ron)?.*$/i, '')
		.replace(/\s+(?:y|e|and)\s*$/i, '')
		.replace(/[,.؛;]+$/g, '')
		.trim();
	return note || fullText.trim();
}

/** Evita convertir “compré un helado y me costó dos soles” en un gasto de S/1. */
function isItemQuantityBeforeLaterPrice(after: string): boolean {
	return /\b(?:me\s+)?(?:costo|costó|price was|cost)\b/i.test(after);
}

function deferredItemDetail(before: string): string | null {
	const match = /(?:compre|compré|bought)\s+\d+(?:[.,]\d+)?\s+(.+?)\s+(?:y\s+)?(?:me\s+)?(?:costo|costó|cost)\s*$/i.exec(before);
	return match?.[1].replace(/[,.؛;]+$/g, '').trim() || null;
}

/**
 * Separa únicamente montos con contexto monetario. Los tipos y categorías que
 * no se puedan inferir se devuelven con una razón explícita de revisión.
 */
export function parseSpeechBatch(
	text: string,
	categories: Category[] = defaultCategories,
	options: { date: string; locale?: ParserLocale; rules?: PersonalClassificationRule[]; regionalPacks?: RegionalPackId[] } = { date: formatDateOnly(new Date()) }
): SpeechTransactionDraft[] {
	const locale = options.locale ?? 'es-PE';
	const parsedText = replaceSpokenAmounts(text, locale);
	const matches = [...parsedText.matchAll(MONEY_NUMBER)];
	const drafts: SpeechTransactionDraft[] = [];
	let previousAcceptedEnd = 0;

	for (let index = 0; index < matches.length; index += 1) {
		const match = matches[index];
		const amount = parseLocalizedAmount(match[0]);
		if (!amount) continue;
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const nextStart = matches[index + 1]?.index ?? parsedText.length;
		const before = parsedText.slice(previousAcceptedEnd, start);
		const after = parsedText.slice(end, nextStart);
		const action = lastActionIn(before, locale);
		const hasCurrency = CURRENCY_BEFORE.test(before) || CURRENCY_AFTER.test(after);
		const isContinuation = drafts.length > 0 && CONTINUATION_DETAIL.test(after);
		if ((!action && !hasCurrency && !isContinuation) || (!hasCurrency && isItemQuantityBeforeLaterPrice(after))) continue;

		const inheritedType = drafts.at(-1)?.type;
		const type = action ?? inheritedType ?? 'expense';
		const deferredDetail = deferredItemDetail(before);
		const detail = deferredDetail ?? noteForSegment(after, parsedText);
		const learned = findLearnedRule(detail, locale, options.rules ?? []);
		const resolvedType = learned?.type ?? type;
		const detectedCategory = categoryMatchForText(after, type, locale) ?? categoryMatchForText(deferredDetail ?? before, type, locale) ?? regionalCategoryMatch(`${before} ${after}`, options.regionalPacks ?? ['pe']);
		const learnedCategory = learned ? categories.find((category) => category.id === learned.categoryId && category.type === resolvedType) : undefined;
		const categoryCode = learned
			? learnedCategory?.code ?? (learnedCategory ? 'custom' : 'uncategorized')
			: detectedCategory?.code ?? 'uncategorized';
		const resolvedCategoryId = learnedCategory?.id ?? categoryIdForCode(categories, categoryCode === 'custom' ? 'uncategorized' : categoryCode, resolvedType);
		const merchant = merchantForText(deferredDetail ?? after, locale);
		const counterparty = resolvedType === 'income' ? counterpartyForText(`${before} ${after}`, locale) : undefined;
		const explanation = [
			...(learned ? [`Regla personal: “${learned.phrase}”`] : []),
			...(action ? [`Detecté una acción de ${type === 'income' ? 'ingreso' : 'gasto'}`] : []),
			...(detectedCategory && !learned ? [`${categoryCode}, porque detecté “${detectedCategory.keyword}”`] : []),
			...(merchant ? [`Comercio/lugar detectado: ${merchant}`] : []),
			...(counterparty ? [`Contraparte detectada: ${counterparty}`] : [])
		];
		const reviewReasons: SpeechReviewReason[] = [
			...(learned || action || inheritedType ? [] : ['type' as const]),
			...(!learnedCategory && categoryCode === 'uncategorized' ? ['category' as const] : [])
		];
		drafts.push({
			id: `speech-${drafts.length}`,
			amount,
			categoryCode,
			categoryId: resolvedCategoryId,
			type: resolvedType,
			note: detail,
			date: dateForText(text, options.date, locale),
			reviewReasons,
			merchant,
			location: undefined,
			counterparty,
			incomeSource: resolvedType === 'income' ? incomeSourceForText(`${before} ${after}`, locale) : undefined,
			subcategory: subcategoryForText(`${before} ${after}`, categoryCode === 'custom' ? 'uncategorized' : categoryCode),
			explanation
		});
		previousAcceptedEnd = end;
	}
	return drafts;
}

/** Compatibilidad para los consumidores que solamente necesitan el primer movimiento. */
export function parseSpeech(text: string, categories: Category[] = defaultCategories) {
	const [first] = parseSpeechBatch(text, categories);
	return first
		? { amount: first.amount, categoryCode: first.categoryCode, categoryId: first.categoryId, type: first.type, note: text }
		: { amount: null, categoryCode: 'uncategorized' as CategoryCode, categoryId: categoryIdForCode(categories, 'uncategorized', 'expense'), type: 'expense' as const, note: text };
}
