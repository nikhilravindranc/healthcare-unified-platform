"use client";
import { useQuery } from "@tanstack/react-query";
import { enquiriesApi } from "./api";

export const useEnquiries = () => useQuery({ queryKey: ["enquiries"], queryFn: enquiriesApi.list });
