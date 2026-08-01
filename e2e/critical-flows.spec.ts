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

test('registra un gasto y lo refleja en el inicio', async ({ page }) => {
	await page.goto('/registro');
	await page.getByTestId('transaction-amount').fill('25.50');
	await page.locator('#transaction-note').fill('Almuerzo de prueba');
	await page.getByTestId('transaction-save').click();

	await expect(page).toHaveURL('/');
	await expect(page.getByText('Almuerzo de prueba', { exact: true })).toBeVisible();
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

	await page.goto('/');
	await expect(page.getByText('Supermercado', { exact: true })).toBeVisible();
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
	await page.locator('#app-unlock-pin').fill('0000');
	await page.getByRole('button', { name: 'Desbloquear' }).click();
	await expect(page.getByText('PIN incorrecto.', { exact: true })).toBeVisible();
	await page.locator('#app-unlock-pin').fill('1234');
	await page.getByRole('button', { name: 'Desbloquear' }).click();
	await expect(page.getByRole('heading', { name: 'Gestor bloqueado' })).not.toBeVisible();
});
