"use client";
import { useQuery } from "@tanstack/react-query";
import { campaignsApi } from "./api";

export const useCampaigns = () => useQuery({ queryKey: ["campaigns"], queryFn: campaignsApi.list });
