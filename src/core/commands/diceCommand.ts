import { Command } from "../../lib/structures/Command.js";
import type { Context } from "../../lib/types/Context.js";

class DiceCommand extends Command {
	private static readonly RATE_LIMIT = 5_000; // 5 seconds between dice rolls

	private lastUsage = new Map<number, number>();

	public constructor() {
		super({
			name: "dice",
			description: "Бросить кубик.",
		});
	}

	public async execute(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;
		if (!userId) return;

		const now = Date.now();
		const lastUse = this.lastUsage.get(userId) ?? 0;

		if (now - lastUse < DiceCommand.RATE_LIMIT) {
			const waitTime = Math.ceil((DiceCommand.RATE_LIMIT - (now - lastUse)) / 1_000);
			await ctx.reply(`⏳ Подождите ${waitTime} сек. перед следующим броском.`);
			return;
		}

		this.lastUsage.set(userId, now);
		await ctx.sendDice();
	}
}

export const diceCommand = new DiceCommand();
