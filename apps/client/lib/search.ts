// import { SearchFilters } from "@repo/types";
import { searchProfessionalsAction } from "@/app/actions/search";

export async function searchProfessionals(query: string) {
    // Note: filters are not yet implemented in the MVP action
    const results = await searchProfessionalsAction(query);
    return {
        success: true,
        data: results
    };
}

export async function autoComplete(query: string) {
    // Reuse search action for autocomplete in MVP
    const results = await searchProfessionalsAction(query);
    return {
        success: true,
        data: results.map(p => ({
            id: p.userId,
            text: p.companyName,
            type: 'professional'
        }))
    };
}