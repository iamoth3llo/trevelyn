import { fetch } from "undici";
import type { RequestInit, HeadersInit } from "undici";

export type IAirport = {
	readonly city: string;
	readonly country: string;
	readonly iata: string;
	readonly name: string;
};

export type IFlight = {
	readonly airline: string;
	readonly arrivalTime: string;
	readonly departureTime: string;
	readonly direct: boolean;
	readonly duration: number;
	readonly flightNumber: string;
	readonly price: number;
};

type AviasalesResponse = {
	readonly data: Record<
		string,
		{
			readonly [key: string]: {
				readonly airline: string;
				readonly departure_at: string;
				readonly expires_at: string;
				readonly flight_number: string;
				readonly price: number;
				readonly return_at: string;
				readonly transfers: number;
			};
		}
	>;
	readonly success: boolean;
};

type PlaceResponse = {
	readonly city_name?: string;
	readonly code: string;
	readonly country_name?: string;
	readonly name: string;
	readonly type: "airport" | "city";
};

type SearchParams = {
	readonly adults: number;
	readonly departureDate: string;
	readonly destination: string;
	readonly direct?: boolean;
	readonly origin: string;
	readonly returnDate?: string;
};

export class AviasalesClient {
	private static readonly API_RATE_LIMIT = 1_000; // 1 request per second

	private readonly priceUrl = "https://api.travelpayouts.com/v1/prices/cheap";

	private readonly searchUrl = "https://autocomplete.travelpayouts.com/places2";

	private readonly token: string;

	private lastRequestTime = 0;

	private static readonly RUSSIAN_AIRPORTS: ReadonlyMap<string, readonly IAirport[]> = new Map([
		[
			"Москва",
			[
				{ iata: "SVO", name: "Шереметьево", city: "Москва", country: "Россия" },
				{ iata: "DME", name: "Домодедово", city: "Москва", country: "Россия" },
				{ iata: "VKO", name: "Внуково", city: "Москва", country: "Россия" },
				{ iata: "ZIA", name: "Жуковский", city: "Москва", country: "Россия" },
			] as const,
		],
		["Санкт-Петербург", [{ iata: "LED", name: "Пулково", city: "Санкт-Петербург", country: "Россия" }] as const],
		["Сочи", [{ iata: "AER", name: "Сочи", city: "Сочи", country: "Россия" }] as const],
		["Казань", [{ iata: "KZN", name: "Казань", city: "Казань", country: "Россия" }] as const],
		["Екатер��нбург", [{ iata: "SVX", name: "Кольцово", city: "Екатеринбург", country: "Россия" }] as const],
		["Новосибирск", [{ iata: "OVB", name: "Новосибирск", city: "Новосибирск", country: "Россия" }] as const],
		["Краснодар", [{ iata: "KRR", name: "Пашковский", city: "Краснодар", country: "Россия" }] as const],
		["Калининград", [{ iata: "KGD", name: "Храброво", city: "Калининград", country: "Россия" }] as const],
	]);

	public constructor() {
		const token = process.env.AVIASALES_TOKEN;
		if (!token) {
			throw new Error("AVIASALES_TOKEN is not specified in environment variables");
		}

		this.token = token;
	}

	private async rateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < AviasalesClient.API_RATE_LIMIT) {
			await new Promise<void>((resolve) => {
				setTimeout(() => {
					resolve();
				}, AviasalesClient.API_RATE_LIMIT - timeSinceLastRequest);
			});
		}

		this.lastRequestTime = Date.now();
	}

	private async makeRequest<T>(url: string, options?: RequestInit): Promise<T> {
		await this.rateLimit();

		const response = await fetch(url, {
			...options,
			headers: {
				Accept: "application/json",
				"X-Access-Token": this.token,
				...options?.headers,
			} as HeadersInit,
		} as RequestInit);

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	public async searchAirports(city: string, country = "Россия"): Promise<IAirport[]> {
		try {
			// First try to get from predefined airports
			const knownAirports = AviasalesClient.RUSSIAN_AIRPORTS.get(city);
			if (knownAirports) {
				console.log(`Found predefined airports for ${city}`);
				return [...knownAirports]; // Create a mutable copy using spread operator
			}

			// If not found in predefined list, try API
			console.log(`Searching API for '${city}' in ${country}`);
			const airports = await this.makeRequest<PlaceResponse[]>(
				`${this.searchUrl}?term=${encodeURIComponent(city)}&locale=ru&types[]=airport`,
			);
			console.log("Raw API response:", airports);

			return airports
				.filter((airport) => {
					const cityMatch = airport.city_name?.toLowerCase() === city.toLowerCase();
					const countryMatch = airport.country_name === country;
					return airport.type === "airport" && countryMatch && cityMatch;
				})
				.map((airport) => ({
					iata: airport.code,
					name: airport.name,
					city: airport.city_name ?? city,
					country: airport.country_name ?? country,
				}));
		} catch (error) {
			console.error("Airport search error:", error);
			throw new Error("Failed to search airports");
		}
	}

	public async searchFlights(params: SearchParams): Promise<IFlight[]> {
		try {
			const queryParams = new URLSearchParams(
				Object.fromEntries(
					Object.entries({ ...params, token: this.token }).map(([key, value]) => [key, String(value)]),
				),
			);

			const data = await this.makeRequest<AviasalesResponse>(`${this.priceUrl}?${queryParams.toString()}`);

			return this.transformFlightData(data);
		} catch (error) {
			console.error("Flight search error:", error);
			throw new Error("Failed to search flights");
		}
	}

	private transformFlightData(data: AviasalesResponse): IFlight[] {
		if (!data.success || !data.data) return [];

		const flights: IFlight[] = [];

		for (const [, routes] of Object.entries(data.data)) {
			for (const [, flight] of Object.entries(routes)) {
				flights.push({
					airline: flight.airline,
					arrivalTime: flight.return_at || "",
					departureTime: flight.departure_at,
					direct: flight.transfers === 0,
					duration: this.calculateDuration(flight.departure_at, flight.return_at),
					flightNumber: flight.flight_number,
					price: flight.price,
				});
			}
		}

		return flights.sort((a, b) => a.price - b.price);
	}

	private calculateDuration(departure: string, arrival: string): number {
		if (!arrival) return 0;

		const departureTime = new Date(departure);
		const arrivalTime = new Date(arrival);

		return Math.floor((arrivalTime.getTime() - departureTime.getTime()) / 60_000);
	}
}
