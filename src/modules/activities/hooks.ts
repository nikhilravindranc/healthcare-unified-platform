import { useQuery } from "@tanstack/react-query";
import { activitiesApi } from "./api";
export const useActivities = () => useQuery({ queryKey: ["activities"], queryFn: activitiesApi.list });
