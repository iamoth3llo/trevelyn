import * as process from "node:process";
import { Telegraf, session } from "telegraf";
import type { CallbackQuery } from "telegraf/types";
import { diceCommand } from "../../core/commands/diceCommand.js";
import { searchCommand } from "../../core/commands/searchCommand.js";
import { startCommand } from "../../core/commands/startCommand.js";
import { createInitialSession, isSessionExpired } from "../types/Context.js";
import type { Context } from "../types/Context.js";

const INACTIVE_TIMEOUT = 30 * 60 * 1_000; // 30 minutes

export class TrevelynClient {
	public readonly bot: Telegraf<Context>;

	private readonly commands: ReadonlySet<typeof diceCommand | typeof searchCommand | typeof startCommand>;

	public constructor() {
		const token = process.env.TELEGRAM_BOT_TOKEN;
		if (!token) {
			throw new Error("TELEGRAM_BOT_TOKEN is not specified in environment variables");
		}

		this.bot = new Telegraf<Context>(token);
		this.commands = new Set([diceCommand, searchCommand, startCommand]);

		this.setupMiddleware();
		this.registerHandlers();
	}

	private setupMiddleware(): void {
		this.bot.use(session());
		this.bot.use(this.sessionMiddleware.bind(this));
		this.bot.use(this.activityMiddleware.bind(this));

		// Add error-handling middleware
		this.bot.use(async (ctx, next) => {
			try {
				await next();
			} catch (error) {
				await this.handleError(error, ctx);
			}
		});
	}

	private async sessionMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
		if (!ctx.session) {
			Object.assign(ctx, { session: createInitialSession() });
		}

		await next();
	}

	private async activityMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
		if (isSessionExpired(ctx.session, INACTIVE_TIMEOUT)) {
			Object.assign(ctx, { session: createInitialSession() });
		}

		Object.assign(ctx.session, { lastActivity: new Date() });
		await next();
	}

	private registerHandlers(): void {
		this.registerCommands();
		this.registerActions();
		this.registerMessageHandler();
	}

	private registerCommands(): void {
		for (const command of this.commands) {
			this.bot.command(command.name, async (ctx) => {
				await this.handleCommand(command.execute(ctx));
			});
		}
	}

	private registerActions(): void {
		// Main menu actions
		this.bot.action("search_tickets", async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.execute(ctx));
		});

		this.bot.action(["create_subscription", "auto_registration", "travel_together"], async (ctx) => {
			await ctx.answerCbQuery();
			await ctx.reply("🛠 Данный функционал находится в процессе разработки.");
		});

		// Airport selection handler with improved type safety
		this.bot.action(/^airport_[A-Z]{3}$/, async (ctx) => {
			const query = ctx.callbackQuery as CallbackQuery.DataQuery;
			const iata = query.data?.replace("airport_", "");

			if (!iata) return;

			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleDepartureAirport(ctx, iata));
		});

		// Handle trip type selection separately
		this.bot.action(/^trip_(?:roundtrip|oneway)$/, async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleTripTypeSelection(ctx));
		});

		// Calendar actions
		this.bot.action(/^calendar_.*/, async (ctx) => {
			await this.handleCommand(searchCommand.handleCalendarAction(ctx));
		});

		// Add airline selection handler
		this.bot.action(/^airline_/, async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleMessage(ctx));
		});

		// Add date preference handler
		this.bot.action(/^date_/, async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleMessage(ctx));
		});

		// Add flight preferences handler
		this.bot.action(/^flight_(?:direct|any)$/, async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleMessage(ctx));
		});

		// Add passenger selection handler
		this.bot.action(/^passengers_[1-4]$/, async (ctx) => {
			await ctx.answerCbQuery();
			await this.handleCommand(searchCommand.handleMessage(ctx));
		});
	}

	private registerMessageHandler(): void {
		this.bot.on("message", async (ctx) => {
			if (!ctx.session?.state) return;

			await this.handleCommand(searchCommand.handleMessage(ctx));
		});
	}

	private async handleError(error: unknown, ctx: Context): Promise<void> {
		console.error("Error handling update:", error);
		await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.");
	}

	private async handleCommand(promise: Promise<void>): Promise<void> {
		try {
			await promise;
		} catch (error) {
			console.error("Error executing command:", error);
		}
	}

	public async start(): Promise<void> {
		await this.bot.launch();
	}
}
