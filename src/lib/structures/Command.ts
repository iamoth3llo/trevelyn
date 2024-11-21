import type { Context } from "../types/Context.js";

export type CommandOptions = {
	readonly description: string;
	readonly name: string;
};

export abstract class Command {
	public readonly name: string;

	public readonly description: string;

	protected constructor(options: CommandOptions) {
		this.validateOptions(options);
		this.name = options.name;
		this.description = options.description;
	}

	private validateOptions(options: CommandOptions): void {
		if (!this.isValidCommandName(options.name)) {
			throw new Error(
				"Command name must be a non-empty string containing only lowercase letters, numbers and underscores",
			);
		}

		if (!this.isValidDescription(options.description)) {
			throw new Error("Command description must be a non-empty string");
		}
	}

	private isValidCommandName(name: string): boolean {
		return /^[\d_a-z]+$/.test(name);
	}

	private isValidDescription(description: string): boolean {
		return typeof description === "string" && description.trim().length > 0;
	}

	public abstract execute(ctx: Context): Promise<void>;
}
