import { Markup } from "telegraf";
import type { KeyboardButton, CallbackQuery } from "telegraf/types";
import { AviasalesClient } from "../../lib/api/AviasalesClient.js";
import { Command } from "../../lib/structures/Command.js";
import type { Context } from "../../lib/types/Context.js";
import { Calendar } from "../../lib/utils/Calendar.js";

/**
 * Список доступных авиакомпаний
 */
const AIRLINES = ["Аэрофлот", "S7 Airlines", "Победа", "UTair", "Red Wings", "Россия"] as const;

/**
 * Популярные города России
 */
const POPULAR_CITIES_ARRAY = [
	["Москва", "Санкт-Петербург"],
	["Казань", "Сочи"],
	["Екатеринбург", "Новосибирск"],
	["Краснодар", "Калининград"],
] as KeyboardButton[][];

/**
 * Состояния процесса поиска
 */
enum SearchStep {
	AIRLINE = "airline",
	DATE_PREFERENCE = "date_preference",
	DEPARTURE_AIRPORT = "departure_airport",
	DEPARTURE_CITY = "departure_city",
	DESTINATION_CITY = "destination_city",
	FLIGHT_PREFERENCES = "flight_preferences",
	PASSENGER_INFO = "passenger_info",
	SEARCH_RESULTS = "search_results",
	SELECT_DATES = "select_dates",
	TRIP_TYPE = "trip_type",
}

type SearchStepState = {
	[K in SearchStep]: (ctx: Context, data?: string) => Promise<void>;
};

/**
 * Команда поиска авиабилетов.
 * Позволяет пользователю пошагово указать параметры поиска авиабилетов.
 */
class SearchCommand extends Command {
	private readonly aviasales = new AviasalesClient();

	private readonly stepHandlers: SearchStepState = {
		[SearchStep.DEPARTURE_CITY]: async (ctx: Context, data?: string) => {
			if (!data) return;
			await this.handleDepartureCity(ctx, data);
		},
		[SearchStep.DEPARTURE_AIRPORT]: async (ctx: Context, data?: string) => {
			if (!data) return;
			await this.handleDepartureAirport(ctx, data);
		},
		[SearchStep.TRIP_TYPE]: async (ctx: Context, data?: string) => {
			console.log("Trip type handler called with data:", data); // Debug log

			if (!data?.startsWith("trip_")) return;

			try {
				const currentSession = { ...ctx.session };
				currentSession.searchState = {
					...currentSession.searchState,
					isRoundTrip: data === "trip_roundtrip",
				};
				currentSession.state = SearchStep.DESTINATION_CITY;
				Object.assign(ctx, { session: currentSession });

				console.log("Session updated, new state:", currentSession.state); // Debug log

				// First remove the inline keyboard
				if (ctx.callbackQuery) {
					await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
				}

				// Then send the new message
				await ctx.reply("🌆 Выберите или введите город назначения:", {
					reply_markup: {
						keyboard: POPULAR_CITIES_ARRAY,
						one_time_keyboard: true,
						resize_keyboard: true,
					},
				});
			} catch (error) {
				console.error("Error in trip type handler:", error);
				await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.");
			}
		},
		[SearchStep.DESTINATION_CITY]: async (ctx: Context, data?: string) => {
			if (!data) return;
			try {
				const airports = await this.aviasales.searchAirports(data);
				if (airports.length > 0) {
					const currentSession = { ...ctx.session };
					currentSession.searchState = {
						...currentSession.searchState,
						destinationCity: data,
						destinationAirport: airports[0].iata, // Use first airport by default
					};
					currentSession.state = SearchStep.AIRLINE;
					Object.assign(ctx, { session: currentSession });

					console.log("Setting up airline selection, current state:", currentSession.state); // Debug log

					// Remove old keyboard and show airline selection
					await ctx.reply("✈️ Выберите предпочитаемую авиакомпанию:", {
						reply_markup: {
							remove_keyboard: true,
							inline_keyboard: AIRLINES.map((airline) => [Markup.button.callback(airline, `airline_${airline}`)]),
						},
					});
				} else {
					await ctx.reply("❌ Город не найден. Пожалуйста, проверьте название и попробуйте снова.", {
						reply_markup: {
							keyboard: POPULAR_CITIES_ARRAY,
							one_time_keyboard: true,
							resize_keyboard: true,
						},
					});
				}
			} catch (error) {
				console.error("Failed to search airports:", error);
				await ctx.reply("❌ Произошла ошибка при поиске аэропортов. Попробуйте позже.");
			}
		},
		[SearchStep.DATE_PREFERENCE]: async (ctx: Context, data?: string) => {
			if (!data?.startsWith("date_")) return;

			const currentSession = { ...ctx.session };
			currentSession.searchState = {
				...currentSession.searchState,
				isFlexibleDates: data === "date_flexible",
			};
			currentSession.state = SearchStep.FLIGHT_PREFERENCES;
			Object.assign(ctx, { session: currentSession });

			const keyboard = Markup.inlineKeyboard([
				[Markup.button.callback("✅ Только прямые", "flight_direct")],
				[Markup.button.callback("🔄 С пересадками", "flight_any")],
			]);

			await ctx.reply("✈️ Предпочтения по перелету:", keyboard);
		},
		[SearchStep.FLIGHT_PREFERENCES]: async (ctx: Context, data?: string) => {
			if (!data?.startsWith("flight_")) return;

			const currentSession = { ...ctx.session };
			currentSession.searchState = {
				...currentSession.searchState,
				isDirect: data === "flight_direct",
			};
			currentSession.state = SearchStep.PASSENGER_INFO;
			Object.assign(ctx, { session: currentSession });

			// First remove the flight preferences keyboard
			await ctx.editMessageText(
				`✈️ ${data === "flight_direct" ? "Выбраны только прямые рейсы" : "Выбраны рейсы с пересадками"}`,
			);

			// Then show passenger selection keyboard
			await ctx.reply("👥 Выберите количество пассажиров:", {
				reply_markup: {
					inline_keyboard: [
						[1, 2, 3, 4].map((num) =>
							Markup.button.callback(`${num} ${this.getPassengerWord(num)}`, `passengers_${num}`),
						),
					],
				},
			});
		},
		[SearchStep.PASSENGER_INFO]: async (ctx: Context, data?: string) => {
			if (!data?.startsWith("passengers_")) return;
			const passengers = Number.parseInt(data.replace("passengers_", ""), 10); // Added radix parameter

			const currentSession = { ...ctx.session };
			currentSession.searchState = {
				...currentSession.searchState,
				passengerCount: passengers,
			};
			currentSession.state = SearchStep.SELECT_DATES;
			Object.assign(ctx, { session: currentSession });

			await ctx.reply("📅 Выберите дату вылета:", Calendar.generate(new Date()));
		},
		[SearchStep.SELECT_DATES]: async (ctx: Context) => {
			await this.handleCalendarAction(ctx);
		},
		[SearchStep.SEARCH_RESULTS]: async (ctx: Context) => {
			const state = ctx.session.searchState!;
			const keyboard = Markup.inlineKeyboard([
				[Markup.button.url("🎫 Забронировать", `https://aviasales.ru/search?origin_iata=${state.departureAirport}`)],
				[Markup.button.callback("🔄 Новый поиск", "search_tickets")],
			]);

			await ctx.reply("Выберите действие:", keyboard);
		},
		[SearchStep.AIRLINE]: async (_ctx: Context, _data?: string) => {
			// This is a placeholder to satisfy the type system
			// The actual airline handling is done in handleMessage
			console.log("Airline step handler called, but handling is done in handleMessage");
		},
	};

	public constructor() {
		super({
			name: "search",
			description: "Поиск авиабилетов",
		});
	}

	public async execute(ctx: Context): Promise<void> {
		const session = {
			data: {},
			lastActivity: new Date(),
			state: "",
		};
		Object.assign(ctx, { session });

		const searchState = {};
		const state = SearchStep.DEPARTURE_CITY;
		Object.assign(ctx.session, { searchState, state });

		await ctx.reply("🌆 Выберите или введите город отправления:", {
			reply_markup: {
				keyboard: POPULAR_CITIES_ARRAY,
				one_time_keyboard: true,
				resize_keyboard: true,
			},
		});
	}

	/**
	 * Обработчик сообщений для всех шагов поиска.
	 *
	 * @param ctx - Контекст команды
	 */
	public async handleMessage(ctx: Context): Promise<void> {
		if (!ctx.message && !ctx.callbackQuery) return;

		// Handle callback queries
		if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
			const data = ctx.callbackQuery.data;
			console.log("Received callback:", data);
			console.log("Current state:", ctx.session.state);

			try {
				// Add explicit handling for flight preferences
				if (data.startsWith("flight_")) {
					const handler = this.stepHandlers[SearchStep.FLIGHT_PREFERENCES];
					await handler(ctx, data);
					await ctx.answerCbQuery();
					return;
				}

				// Handle airport selection
				if (data.startsWith("airport_")) {
					const iata = data.replace("airport_", "");
					await this.handleDepartureAirport(ctx, iata);
					await ctx.answerCbQuery();
					return;
				}

				// Handle trip type selection
				if (data.startsWith("trip_")) {
					await this.handleTripTypeSelection(ctx);
					return;
				}

				// Handle airline selection explicitly
				if (data.startsWith("airline_")) {
					console.log("Processing airline selection:", data);
					const airline = data.replace("airline_", "");

					const currentSession = { ...ctx.session };
					currentSession.searchState = {
						...currentSession.searchState,
						airline,
					};
					currentSession.state = SearchStep.DATE_PREFERENCE;
					Object.assign(ctx, { session: currentSession });

					console.log("Updated session for airline selection:", currentSession);

					await ctx.editMessageText("🗓 Как бы вы хотели выбрать даты?", {
						reply_markup: {
							inline_keyboard: [
								[Markup.button.callback("📅 Конкретные даты", "date_specific")],
								[Markup.button.callback("📊 Гибкие даты", "date_flexible")],
							],
						},
					});
					await ctx.answerCbQuery();
					return;
				}

				// Handle all other callbacks through step handlers
				const handler = this.stepHandlers[ctx.session.state as SearchStep];
				if (handler) {
					console.log("Found handler for state:", ctx.session.state);
					await handler(ctx, data);
					await ctx.answerCbQuery();
				} else {
					console.log("No handler found for state:", ctx.session.state);
					await ctx.answerCbQuery();
				}
			} catch (error) {
				console.error("Error handling callback:", error);
				await ctx.answerCbQuery("❌ Произошла ошибка");
				await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.");
			}

			return;
		}

		// Handle text messages
		if (ctx.message && "text" in ctx.message) {
			const handler = this.stepHandlers[ctx.session.state as SearchStep];
			if (handler) {
				await handler(ctx, ctx.message.text);
			}
		}
	}

	/**
	 * Обработчик действий календаря
	 */
	public async handleCalendarAction(ctx: Context): Promise<void> {
		if (!("data" in ctx.callbackQuery!)) return;

		const data = ctx.callbackQuery.data;

		if (data === "calendar_ignore") {
			await ctx.answerCbQuery();
			return;
		}

		if (data === "calendar_done") {
			await this.handleCalendarDone(ctx);
			return;
		}

		if (data.startsWith("calendar_date_")) {
			await this.handleCalendarDateSelect(ctx, data);
			return;
		}

		// Handle navigation
		if (data.startsWith("calendar_prev_") || data.startsWith("calendar_next_")) {
			try {
				const [, , year, month] = data.split("_");
				const date = new Date(Number(year), Number(month));

				// Check if date is valid using Number.isNaN instead of isNaN
				if (Number.isNaN(date.getTime())) {
					throw new TypeError("Invalid date");
				}

				const calendar = Calendar.generate(date);

				// Only update if we have a new keyboard
				if (calendar.reply_markup.inline_keyboard) {
					await ctx.editMessageReplyMarkup({
						inline_keyboard: calendar.reply_markup.inline_keyboard,
					});
				}
			} catch (error) {
				console.error("Calendar navigation error:", error);
			}

			await ctx.answerCbQuery();
		}
	}

	/**
	 * Обработка ввода города отправления.
	 *
	 * @param ctx - Контекст команды
	 * @param city - Введенный город
	 */
	private async handleDepartureCity(ctx: Context, city: string): Promise<void> {
		try {
			console.log("Searching airports for city:", city); // Debug log
			const airports = await this.aviasales.searchAirports(city);
			console.log("Found airports:", airports); // Debug log

			if (airports.length > 0) {
				const currentSession = { ...ctx.session };
				currentSession.searchState = {
					...currentSession.searchState,
					departureCity: city,
				};
				currentSession.state = SearchStep.DEPARTURE_AIRPORT;
				Object.assign(ctx, { session: currentSession });

				// Single message with inline keyboard
				await ctx.reply("✈️ Выберите аэропорт вылета:", {
					reply_markup: {
						remove_keyboard: true,
						inline_keyboard: airports.map((airport) => [
							{
								text: `${airport.name} (${airport.iata})`,
								callback_data: `airport_${airport.iata}`,
							},
						]),
					},
				});
			} else {
				await ctx.reply("❌ Город не найден в России. Пожалуйста, проверьте название и попробуйте снова:", {
					reply_markup: {
						keyboard: POPULAR_CITIES_ARRAY,
						one_time_keyboard: true,
						resize_keyboard: true,
					},
				});
			}
		} catch (error) {
			console.error("Failed to search airports:", error);
			await ctx.reply("❌ Произошла ошибка при поиске аэропортов. Попробуйте позже.");
		}
	}

	/**
	 * Обработка выбора аэропорта вылета.
	 *
	 * @param ctx - Контекст команды
	 * @param iata - IATA код аэропорта
	 */
	public async handleDepartureAirport(ctx: Context, iata: string): Promise<void> {
		console.log("Handling departure airport:", iata); // Debug log

		const currentSession = { ...ctx.session };
		currentSession.searchState = {
			...currentSession.searchState,
			departureAirport: iata,
		};
		currentSession.state = SearchStep.TRIP_TYPE;
		Object.assign(ctx, { session: currentSession });

		console.log("Updated session state:", currentSession.state); // Debug log

		// Replace the airport selection message with trip type selection
		await ctx.editMessageText("🛫 Выберите тип поездки:", {
			reply_markup: {
				inline_keyboard: [
					[Markup.button.callback("🔄 Туда и обратно", "trip_roundtrip")],
					[Markup.button.callback("↗️ Только туда", "trip_oneway")],
				],
			},
		});
	}

	private async handleCalendarDateSelect(ctx: Context, data: string): Promise<void> {
		const [, , year, month, day] = data.split("_");
		const selectedDate = new Date(Number(year), Number(month), Number(day));

		if (ctx.session.searchState!.departureDate) {
			Object.assign(ctx.session.searchState!, { returnDate: selectedDate });
			await this.handleCalendarDone(ctx);
		} else {
			Object.assign(ctx.session.searchState!, { departureDate: selectedDate });

			if (ctx.session.searchState!.isRoundTrip) {
				await ctx.reply("📅 Теперь выберите дату возвращения:", Calendar.generate(selectedDate));
			} else {
				await this.handleCalendarDone(ctx);
			}
		}

		await ctx.answerCbQuery();
	}

	private async handleCalendarDone(ctx: Context): Promise<void> {
		const state = ctx.session.searchState!;
		const departureDate = new Date(state.departureDate!);

		let summaryMessage = `
📅 Выбранные даты:
🛫 Вылет: ${departureDate.toLocaleDateString("ru")}`;

		if (state.isRoundTrip && state.returnDate) {
			const returnDate = new Date(state.returnDate);
			summaryMessage += `
🛬 Возвращение: ${returnDate.toLocaleDateString("ru")}`;
		}

		summaryMessage += `
👥 Пассажиров: ${state.passengerCount}
✈️ Авиакомпания: ${state.airline}
${state.isDirect ? "✅ Только прямые рейсы" : "🔄 С пересадками"}`;

		await ctx.reply(summaryMessage);
		await ctx.reply("🔍 Ищем билеты...");
		await this.searchFlights(ctx);
	}

	private async searchFlights(ctx: Context): Promise<void> {
		try {
			const state = ctx.session.searchState!;

			const flights = await this.aviasales.searchFlights({
				origin: state.departureAirport!,
				destination: state.destinationAirport!,
				departureDate: state.departureDate!.toISOString(),
				returnDate: state.isRoundTrip ? state.returnDate!.toISOString() : undefined,
				adults: state.passengerCount!,
				direct: state.isDirect,
			});

			await this.displaySearchResults(ctx, flights);
		} catch (error) {
			console.error("Failed to search flights:", error);
			await ctx.reply("❌ Произошла ошибка при поиске билетов. Попробуйте позже.");
		}
	}

	private async displaySearchResults(ctx: Context, flights: any[]): Promise<void> {
		if (flights.length > 0) {
			const cheapestFlight = flights[0];
			const message = `
🎉 Найден самый выгодный вариант!

✈️ ${cheapestFlight.airline}
💰 Цена: ${cheapestFlight.price} RUB
🛫 Вылет: ${new Date(cheapestFlight.departureTime).toLocaleString("ru")}
🛬 Прилет: ${new Date(cheapestFlight.arrivalTime).toLocaleString("ru")}
⏱ Длительность: ${Math.floor(cheapestFlight.duration / 60)}ч ${cheapestFlight.duration % 60}м
${cheapestFlight.direct ? "✅ Прямой рейс" : "🔄 С пересадками"}
		`;

			const currentSession = { ...ctx.session };
			currentSession.state = SearchStep.SEARCH_RESULTS;
			Object.assign(ctx, { session: currentSession });

			await ctx.reply(message);
			const state = ctx.session.searchState!;
			const keyboard = Markup.inlineKeyboard([
				[Markup.button.url("🎫 Забронировать", `https://aviasales.ru/search?origin_iata=${state.departureAirport}`)],
				[Markup.button.callback("🔄 Новый поиск", "search_tickets")],
			]);

			await ctx.reply("Выберите действие:", keyboard);
		} else {
			await ctx.reply("😔 К сожалению, билеты по вашему запросу не найдены.");
		}
	}

	// Helper method for passenger count word forms
	private getPassengerWord(count: number): string {
		const words = ["пассажир", "пассажира", "пассажиров"];
		const cases = [2, 0, 1, 1, 1, 2];
		const index = count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)];
		return words[index];
	}

	/**
	 * Handle trip type selection separately from regular message handling
	 */
	public async handleTripTypeSelection(ctx: Context): Promise<void> {
		const query = ctx.callbackQuery as CallbackQuery.DataQuery;
		if (!query?.data) return;

		console.log("Processing trip type selection:", query.data);

		try {
			const currentSession = { ...ctx.session };
			currentSession.searchState = {
				...currentSession.searchState,
				isRoundTrip: query.data === "trip_roundtrip",
			};
			currentSession.state = SearchStep.DESTINATION_CITY;
			Object.assign(ctx, { session: currentSession });

			console.log("Trip type selection complete, new state:", currentSession.state);

			// Clear the inline keyboard
			await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

			// Update the message text to confirm selection
			await ctx.editMessageText(
				`🛫 ${query.data === "trip_roundtrip" ? "Выбран перелет туда и обратно" : "Выбран перелет в одну сторону"}`,
			);

			// Send the destination city selection message
			await ctx.reply("🌆 Выберите или введите город назначения:", {
				reply_markup: {
					keyboard: POPULAR_CITIES_ARRAY,
					one_time_keyboard: true,
					resize_keyboard: true,
				},
			});
		} catch (error) {
			console.error("Error in trip type selection:", error);
			await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.");
		}
	}
}

export const searchCommand = new SearchCommand();
