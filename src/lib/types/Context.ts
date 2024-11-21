import type { Context as TelegrafContext } from "telegraf";

export const TRAVEL_CLASSES = ["economy", "business", "first"] as const;
export type TravelClass = (typeof TRAVEL_CLASSES)[number];

export const DATE_PREFERENCES = ["any", "month", "specific"] as const;
export type DatePreference = (typeof DATE_PREFERENCES)[number];

export type SearchState = {
	readonly airline?: string;
	readonly datePreference?: DatePreference;
	readonly departureAirport?: string;
	readonly departureCity?: string;
	readonly departureDate?: Date;
	readonly destinationAirport?: string;
	readonly destinationCity?: string;
	readonly isDirect?: boolean;
	readonly isFlexibleDates?: boolean;
	readonly isRoundTrip?: boolean;
	readonly luggageCount?: number;
	readonly passengerCount?: number;
	readonly priceRange?: Readonly<{
		readonly max: number;
		readonly min: number;
	}>;
	readonly returnDate?: Date;
	readonly travelClass?: TravelClass;
};

export type Session = {
	readonly data: Record<string, unknown>;
	readonly lastActivity: Date;
	readonly searchState?: SearchState;
	readonly state: string;
};

export type UserState = {
	readonly currentStep: string;
	readonly preferences: Record<string, unknown>;
};

export type Context = Readonly<
	TelegrafContext & {
		session: Session;
		userState: UserState;
	}
>;

// Session management utilities
export const createInitialSession = (): Session => ({
	data: {},
	lastActivity: new Date(),
	state: "",
});

export const isSessionExpired = (session: Session, timeout: number): boolean => {
	const now = Date.now();
	const lastActivity = session.lastActivity.getTime();
	return now - lastActivity > timeout;
};
