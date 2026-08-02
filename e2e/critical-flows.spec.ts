import { expect, test } from '@playwright/test';

async function createUsdAccount(page: import('@playwright/test').Page) {
	await page.goto('/ajustes/cuentas');
	await page.getByRole('button', { name: 'Añadir Cuenta' }).click();
	await page.locator('#account-name').fill('Cuenta USD');
	await page.locator('#account-currency').fill('USD');
	await page.locator('#account-initial-balance').fill('0');
	await page.getByRole('button', { name: 'Guardar' }).click();
	await expect(page.getByText('Cuenta USD', { exact: true })).toBeVisible();
}

function dateInTimeZone(timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
	const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
	return `${value('year')}-${value('month')}-${value('day')}`;
}

test('registra un gasto y lo refleja en el inicio', async ({ page }) => {
	await page.goto('/registro');
	await page.getByTestId('transaction-amount').fill('25.50');
	await page.locator('#transaction-note').fill('Almuerzo de prueba');
	await page.getByTestId('transaction-save').click();

	await expect(page).toHaveURL('/');
	await expect(page.getByText('Almuerzo de prueba', { exact: true })).toBeVisible();
});

test('revisa, confirma y deshace un lote generado desde dictado', async ({ page }) => {
	await page.addInitScript(() => {
		class MockSpeechRecognition {
			lang = '';
			interimResults = false;
			maxAlternatives = 1;
			onresult: ((event: unknown) => void) | null = null;
			onerror: (() => void) | null = null;
			onend: (() => void) | null = null;
			start() {
				queueMicrotask(() => {
					this.onresult?.({ results: [[{ transcript: 'Hoy gasté treinta soles en hotel, doce en comida y veinte en pasajes.' }]] });
					this.onend?.();
				});
			}
			stop() { this.onend?.(); }
		}
		Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition });
	});

	await page.goto('/registro');
	await page.getByTestId('voice-record').click();
	await expect(page.getByText('Revisa antes de guardar', { exact: true })).toBeVisible();
	await expect(page.getByText('Movimiento detectado', { exact: true })).toHaveCount(3);
	const firstVoiceDate = page.locator('input[type="date"]').first();
	await firstVoiceDate.fill('');
	await page.getByTestId('voice-confirm').click();
	await expect(page.getByText('Revisa monto, categoría y fecha de cada movimiento.', { exact: true })).toBeVisible();
	await expect(page.getByTestId('voice-confirm')).toBeEnabled();
	await firstVoiceDate.fill('2026-08-01');
	await page.getByTestId('voice-confirm').click();
	await expect(page.getByText('Se guardaron 3 movimientos.', { exact: true })).toBeVisible();
	await page.getByTestId('voice-undo').click();
	await expect(page.getByText('Se guardaron 3 movimientos.', { exact: true })).not.toBeVisible();
});

test('guarda una transferencia con importe de destino en otra moneda', async ({ page }) => {
	await createUsdAccount(page);
	await page.goto('/registro');
	await page.getByTestId('transaction-type-transfer').click();
	await page.getByTestId('transaction-amount').fill('75');
	await page.locator('#a11y-2').selectOption('default-cash');
	await page.locator('#a11y-3').selectOption({ index: 0 });
	await page.locator('#transfer-destination-amount').fill('20');
	await page.locator('#transaction-note').fill('Cambio a dólares');
	await page.getByTestId('transaction-save').click();

	await expect(page).toHaveURL('/');
	await expect(page.getByText('Cuenta USD', { exact: true })).toBeVisible();
	await expect(page.getByText('USD 20.00', { exact: true })).toBeVisible();
});

test('actualiza solo la moneda activa con el proveedor de tasas', async ({ page }) => {
	let requestedQuotes = '';
	await page.route('https://api.frankfurter.dev/v2/rates?**', async (route) => {
		requestedQuotes = new URL(route.request().url()).searchParams.get('quotes') ?? '';
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify([{ base: 'PEN', quote: 'USD', rate: 0.25, date: '2026-08-01' }])
		});
	});
	await createUsdAccount(page);
	await page.goto('/ajustes/moneda');
	await page.getByRole('button', { name: 'Actualizar ahora' }).click();

	await expect(page.getByText('Tasas actualizadas: USD.', { exact: true })).toBeVisible();
	await expect(page.locator('textarea')).toHaveValue(/USD: 4/);
	expect(requestedQuotes).toBe('USD');
});

test('al cambiar la moneda base invalida las tasas de la base anterior', async ({ page }) => {
	await page.goto('/ajustes/moneda');
	await page.locator('input[placeholder="PEN, USD, EUR..."]').fill('USD');
	await page.getByRole('button', { name: 'Guardar Cambios' }).click();
	await expect(page.locator('textarea')).toHaveValue('');
	await expect(page.getByText('Al guardar, se descartarán las tasas actuales porque pertenecen a la moneda base anterior.', { exact: false })).not.toBeVisible();
});

test('importa un CSV después de mostrar una vista previa', async ({ page }) => {
	await page.goto('/importar');
	await page.locator('input[type="file"]').setInputFiles({
		name: 'estado-cuenta.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('Fecha,Descripción,Monto\n01/08/2026,Supermercado,-35.50')
	});

	await expect(page.getByText('Supermercado', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Importar 1 movimientos' }).click();
	await expect(page.getByText('Importados 1 movimientos.', { exact: true })).toBeVisible();
	await page.waitForTimeout(700);

	await page.goto('/');
	await expect(page.getByText('Supermercado', { exact: true })).toBeVisible();
});

test('vincula un pago recurrente a una deuda pendiente', async ({ page }) => {
	await page.goto('/deudas');
	await page.getByRole('button', { name: 'Añadir deuda' }).click();
	await page.locator('#a11y-15').fill('Banco de prueba');
	await page.locator('#a11y-16').fill('500');
	await page.locator('#debt-installment').fill('100');
	await page.getByRole('button', { name: 'Guardar' }).click();
	await expect(page.getByText('Banco de prueba', { exact: true })).toBeVisible();
	await page.waitForTimeout(700);

	await page.goto('/recurrentes');
	await page.locator('#a11y-6').fill('100');
	await page.locator('#a11y-8').fill(dateInTimeZone('America/Lima'));
	await page.locator('#recurring-debt').selectOption({ index: 1 });
	await page.locator('#a11y-12').fill('Cuota del banco');
	await page.getByRole('button', { name: 'Guardar Recurrente' }).click();
	await expect(page.getByText('Abono a Banco de prueba', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Aprobar' }).click();
	await page.waitForTimeout(700);

	await page.goto('/deudas');
	await expect(page.getByText('S/ 100.00 abonado', { exact: true })).toBeVisible();
	await expect(page.getByText('S/ 400.00', { exact: true })).toBeVisible();
});

test('oculta la exportación de emergencia al bloquearse tras un error real de persistencia', async ({ page }) => {
	await page.addInitScript(() => {
		const originalSetTimeout = window.setTimeout.bind(window);
		window.setTimeout = ((handler, delay, ...args) => originalSetTimeout(handler, delay === 5 * 60 * 1000 ? 0 : delay, ...args)) as typeof window.setTimeout;
	});
	await page.goto('/registro');
	await page.evaluate(() => {
		IDBObjectStore.prototype.put = function () {
			throw new DOMException('Fallo de almacenamiento simulado.', 'QuotaExceededError');
		};
	});
	await page.getByTestId('transaction-amount').fill('1');
	await page.locator('#transaction-note').fill('Forzar fallo de guardado');
	await page.getByTestId('transaction-save').click();
	await expect(page.getByText('No se guardaron los últimos cambios.', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Exportar respaldo ahora' })).toBeVisible();

	await page.goto('/ajustes/seguridad');
	await page.locator('#security-pin').fill('1234');
	await page.locator('#security-confirm-pin').fill('1234');
	await page.getByRole('button', { name: 'Activar bloqueo' }).click();
	await expect(page.getByRole('heading', { name: 'Gestor bloqueado' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Exportar respaldo ahora' })).not.toBeVisible();
});

test('bloquea una nueva sesión y exige el PIN configurado', async ({ page }) => {
	await page.goto('/ajustes/seguridad');
	await page.locator('#security-pin').fill('1234');
	await page.locator('#security-confirm-pin').fill('1234');
	await page.getByRole('button', { name: 'Activar bloqueo' }).click();
	await expect(page.getByText('El bloqueo con PIN está activo.', { exact: true })).toBeVisible();

	await page.evaluate(() => sessionStorage.removeItem('finances_unlocked'));
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Gestor bloqueado' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Exportar respaldo ahora' })).not.toBeVisible();
	await page.locator('#app-unlock-pin').fill('0000');
	await page.getByRole('button', { name: 'Desbloquear' }).click();
	await expect(page.getByText('PIN incorrecto.', { exact: true })).toBeVisible();
	await page.locator('#app-unlock-pin').fill('1234');
	await page.getByRole('button', { name: 'Desbloquear' }).click();
	await expect(page.getByRole('heading', { name: 'Gestor bloqueado' })).not.toBeVisible();
});
