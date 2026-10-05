import { api } from "@/lib/api";
import type { Plan } from "@/types";
import { useApi } from "./useApi";

export function usePlans() {
  return useApi<Plan[]>((signal) => api.get("/plans/", undefined, signal), []);
}
