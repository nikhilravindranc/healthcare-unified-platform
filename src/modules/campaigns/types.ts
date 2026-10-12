import type { ContactStage } from "../crm/contacts";

/**
 * Campaigns (frontend demo). A campaign is configured and reviewed here, and "simulated" at most.
 * Nothing is sent: there is no email or SMS provider, and no real delivery or analytics.
 */
export const CAMPAIGN_CHANNELS = ["email", "sms"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];
export type CampaignStatus = "Draft" | "Scheduled" | "Simulated";

/** Empty lists mean "anyone". Stages and sources are the CRM's derived values, not a second taxonomy. */
export interface AudienceCriteria { stages: ContactStage[]; sources: string[] }

/** Made-up figures for the seeded sample campaign only. They are shown with a "Sample data" label and never computed from real activity. */
export interface SampleMetrics { delivered: number; opened: number; clicked: number; replied: number }

export interface CampaignEvent { at: string; text: string }
export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  subject: string;
  body: string;
  audience: AudienceCriteria;
  status: CampaignStatus;
  scheduledFor?: string;
  createdAt: string; createdBy: string;
  /** Set when the campaign was run in demo mode: how many simulated messages were recorded. */
  simulatedAt?: string; simulatedRecipients?: number;
  sample?: SampleMetrics;
  events: CampaignEvent[];
}
