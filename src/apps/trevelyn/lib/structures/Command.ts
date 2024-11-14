import type { Context } from "../types/Context.js";

export interface CommandOptions {
    description: string;
}

export abstract class Command {
    public readonly name: string;
    public readonly description: string;

    protected constructor(name: string, options: CommandOptions) {
        this.name = name;
        this.description = options.description;
    }

    public abstract execute(ctx: Context): Promise<void>;
}
