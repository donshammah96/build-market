import { apiFetch } from "@/lib/api-client-utils";

export async function searchProfessionals(query: string) {
    const res = await apiFetch<any>(`/api/professionals?search=${encodeURIComponent(query)}`);
    if (!res.success) return res;

    return {
        success: true,
        data: res.data.professionals || []
    };
}

export async function autoComplete(query: string) {
    const res = await apiFetch<any>(`/api/professionals?search=${encodeURIComponent(query)}`);
    if (!res.success) return res;

    return {
        success: true,
        data: (res.data.professionals || []).map((p: any) => ({
            id: p.userId,
            text: p.companyName,
            type: 'professional'
        }))
    };
}