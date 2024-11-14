import * as process from "process";
import { Telegraf } from "telegraf";
import { diceCommand } from "../../core/commands/diceCommand.js";
import { startCommand } from "../../core/commands/startCommand.js";
import type { Context } from "../types/Context.js";

export class TrevelynClient {
	public readonly bot: Telegraf<Context>;

	public constructor() {
		if (!process.env.TELEGRAM_BOT_TOKEN) {
			throw new Error("TELEGRAM_BOT_TOKEN is not specified in environment variables");
		}

		this.bot = new Telegraf<Context>(process.env.TELEGRAM_BOT_TOKEN);
		this.registerHandlers();
	}

	private registerHandlers(): void {
		this.bot.command(diceCommand.name, async (ctx) => diceCommand.execute(ctx));
		this.bot.command(startCommand.name, async (ctx) => startCommand.execute(ctx));

		this.bot.action(["search_tickets", "create_subscription", "auto_registration", "travel_together"], async (ctx) => {
			await ctx.answerCbQuery();
			await ctx.reply("🛠 Данный функционал находится в процессе разработки.");
		});
	}

	public async start(): Promise<void> {
		await this.bot.launch();

		process.once("SIGINT", () => this.bot.stop("SIGINT"));
		process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
	}
}
