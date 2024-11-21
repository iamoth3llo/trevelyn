import { TrevelynClient } from "./lib/structures/TrevelynClient.js";

const startup = async (): Promise<void> => {
	try {
		const client = new TrevelynClient();
		await client.start();

		console.info("🚀 Bot successfully started!");
	} catch (error) {
		console.error("Failed to start the bot:", error);
		process.exit(1);
	}
};

process.on("unhandledRejection", (error: Error) => {
	console.error("Unhandled rejection:", error);
	process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
	console.error("Uncaught exception:", error);
	process.exit(1);
});

void startup();
