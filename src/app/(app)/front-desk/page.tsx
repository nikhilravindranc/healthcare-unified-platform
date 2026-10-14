"use client";
import { TodayView } from "@/components/app/today";

/** Front desk is the Patient flow view of Today, on its own address so the sidebar can mark it active. */
export default function FrontDeskPage() { return <TodayView initialTab="flow" />; }
