import type { Context as TelegrafContext } from "telegraf";

export type Context = TelegrafContext & {
	session: {
		data: Record<string, unknown>;
		lastActivity: Date;
		state: string;
	};
	userState: {
		currentStep: string;
		preferences: Record<string, unknown>;
	};
};
