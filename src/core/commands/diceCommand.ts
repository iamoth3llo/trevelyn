import { Command } from "../../lib/structures/Command.js";
import type { Context } from "../../lib/types/Context.js";

class DiceCommand extends Command {
	public constructor() {
		super("dice", {
			description: "Бросить кубик.",
		});
	}

	public async execute(ctx: Context): Promise<void> {
		await ctx.sendDice();
	}
}

export const diceCommand = new DiceCommand();
