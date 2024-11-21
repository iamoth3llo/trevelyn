import { Markup } from "telegraf";
import { Command } from "../../lib/structures/Command.js";
import type { Context } from "../../lib/types/Context.js";

type MainMenuAction = "auto_registration" | "create_subscription" | "search_tickets" | "travel_together";

const WELCOME_MESSAGE = `Привет! 👋 Меня зовут Тревелин! Я помогу вам найти самые дешёвые авиабилеты! Просто укажите:

— Откуда. ✈️
— Куда. 🌍
— В какие даты вы хотите вылететь. 📆

✈️ Я найду самые дешевые билеты на выбранные даты!

Чем я ещё могу быть полезен:
— Укажите любой месяц вместо точной даты 📆 — и я найду самые дешевые варианты за этот период.
— Выберите диапазон +/- 1–3 дня 📅 — я покажу билеты с захватом этих дат.
— Добавьте багаж 🧳, пересадки 🔄 и их длительность ⏳ — найду билеты с такими условиями.
— Ищу по размеру скидки 💰 — пришлю билеты, если начнется сезон распродаж.
— Выберите приоритетную авиакомпанию 🛩️ — найду билеты с этой авиакомпанией, если они доступны.

Вы можете создать несколько подписок на разные направления и даты, и я проверю все варианты! 👌

Не стесняйтесь мной пользоваться, я люблю помогать! ❤️`;

class StartCommand extends Command {
	private readonly menuButtons: readonly (readonly [string, MainMenuAction])[] = [
		["👀 Найти самые дешёвые билеты", "search_tickets"],
		["🔍 Создать подписку", "create_subscription"],
		["🤖 Автоматическая регистрация", "auto_registration"],
		["✨ Путешествуем вместе ✨", "travel_together"],
	] as const;

	public constructor() {
		super({
			name: "start",
			description: "Начать работу с ботом.",
		});
	}

	public async execute(ctx: Context): Promise<void> {
		await ctx.reply(WELCOME_MESSAGE);

		const keyboard = Markup.inlineKeyboard(
			this.menuButtons.map(([text, callback_data]) => [Markup.button.callback(text, callback_data)]),
		);

		await ctx.reply("📜 Вам доступны следующие функции:", keyboard);
	}
}

export const startCommand = new StartCommand();
