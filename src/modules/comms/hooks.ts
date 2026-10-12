"use client";
import { useQuery } from "@tanstack/react-query";
import { commsApi } from "./api";

export const useMessages = () => useQuery({ queryKey: ["messages"], queryFn: commsApi.list });
