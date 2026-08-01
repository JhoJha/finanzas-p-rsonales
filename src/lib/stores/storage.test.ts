import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('idb-keyval', () => ({ get, set }));

import { loadFinanceSnapshot } from '$lib/stores/storage';

describe('loadFinanceSnapshot', () => {
	beforeEach(() => {
		get.mockReset();
		set.mockReset();
	});

	it('propagates an IndexedDB read failure instead of reporting a missing snapshot', async () => {
		get.mockRejectedValueOnce(new Error('read failed'));
		await expect(loadFinanceSnapshot()).rejects.toThrow('read failed');
		expect(set).not.toHaveBeenCalled();
	});
});
