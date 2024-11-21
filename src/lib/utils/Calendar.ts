import { Markup } from "telegraf";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "telegraf/types";

export class Calendar {
	private static readonly MONTHS = [
		"Январь",
		"Февраль",
		"Март",
		"Апрель",
		"Май",
		"Июнь",
		"Июль",
		"Август",
		"Сентябрь",
		"Октябрь",
		"Ноябрь",
		"Декабрь",
	] as const;

	private static readonly WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

	private static readonly IGNORE_BUTTON = Markup.button.callback(" ", "calendar_ignore");

	public static generate(date = new Date(), selectedDate?: Date): Markup.Markup<InlineKeyboardMarkup> {
		const year = date.getFullYear();
		const month = date.getMonth();

		return Markup.inlineKeyboard([
			...this.generateHeader(year, month),
			...this.generateWeekdays(),
			...this.generateDays(year, month, selectedDate),
			...this.generateNavigation(year, month),
		]);
	}

	private static generateHeader(year: number, month: number): InlineKeyboardButton[][] {
		return [[Markup.button.callback(`${this.MONTHS[month]} ${year}`, `calendar_month_${year}_${month}`)]];
	}

	private static generateWeekdays(): InlineKeyboardButton[][] {
		return [this.WEEKDAYS.map((day) => Markup.button.callback(day, "calendar_ignore"))];
	}

	private static generateDays(year: number, month: number, selectedDate?: Date): InlineKeyboardButton[][] {
		const days: InlineKeyboardButton[][] = [];
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);

		let currentWeek = Array.from({ length: firstDay.getDay() }, () => this.IGNORE_BUTTON);

		for (let day = 1; day <= lastDay.getDate(); day++) {
			const currentDate = new Date(year, month, day);
			const isSelected = selectedDate?.toDateString() === currentDate.toDateString();

			currentWeek.push(
				Markup.button.callback(`${day}${isSelected ? " 📍" : ""}`, `calendar_date_${year}_${month}_${day}`),
			);

			if (currentWeek.length === 7) {
				days.push(currentWeek);
				currentWeek = [];
			}
		}

		if (currentWeek.length > 0) {
			days.push([...currentWeek, ...Array.from({ length: 7 - currentWeek.length }, () => this.IGNORE_BUTTON)]);
		}

		return days;
	}

	private static generateNavigation(year: number, month: number): InlineKeyboardButton[][] {
		const prevDate = new Date(year, month - 1);
		const nextDate = new Date(year, month + 1);

		return [
			[
				Markup.button.callback("◀️", `calendar_prev_${prevDate.getFullYear()}_${prevDate.getMonth()}`),
				Markup.button.callback("Готово ✅", "calendar_done"),
				Markup.button.callback("▶️", `calendar_next_${nextDate.getFullYear()}_${nextDate.getMonth()}`),
			],
		];
	}
}
