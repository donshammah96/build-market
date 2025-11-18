import { SearchFilters } from "@repo/types";

export async function searchProfessionals(query: string, filters?: SearchFilters) {
    const params = new URLSearchParams({
        q: query, 
        ...(filters?.location && { location: filters.location} ),
        ...(filters?.radius && { radius: filters.radius.toString() }),
        ...(filters?.minRating && { minRating: filters.minRating.toString() }),
        ...(filters?.services && { services: filters.services.join(",") })
        });

        const response = await fetch (
            `${process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL}/api/search/professionals?${params}`
        );

        return response.json();
    }

export async function autoComplete(query: string, type: string = "all") {
    const params = new URLSearchParams({
        q: query,
        type,
        limit: "5",
    });

    const response = await fetch(
        `${process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL}/api/search/autocomplete?${params}`
    );

    return response.json();
}