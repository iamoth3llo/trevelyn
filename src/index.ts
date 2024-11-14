import { TrevelynClient } from "./lib/structures/TrevelynClient.js";

void (async () => {
	try {
		const client = new TrevelynClient();
		await client.start();
	} catch (error) {
		console.error("Failed to start the bot:", error);
		process.exit(1);
	}
})();

console.log("🚀 Bot successfully started!");
