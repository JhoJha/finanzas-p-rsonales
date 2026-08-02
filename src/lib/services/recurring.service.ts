import type { RecurringTransaction } from '$lib/schema';
import { dateFromDateOnly, formatDateOnly } from '$lib/utils/date';

export class RecurringService {
	static nextDateAfter(date: Date, frequency: RecurringTransaction['frequency']): Date {
		const next = new Date(date);
		if (frequency === 'daily') next.setDate(next.getDate() + 1);
		else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
		else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
		else next.setMonth(next.getMonth() + 1);
		return next;
	}

	static advanceDate(nextDate: string, occurrence: string, frequency: RecurringTransaction['frequency']): string {
		const candidate = this.nextDateAfter(dateFromDateOnly(occurrence), frequency);
		return candidate > dateFromDateOnly(nextDate) ? formatDateOnly(candidate) : nextDate;
	}

	static nextDateAfterDateOnly(date: string, frequency: RecurringTransaction['frequency']): string {
		return formatDateOnly(this.nextDateAfter(dateFromDateOnly(date), frequency));
	}
}
