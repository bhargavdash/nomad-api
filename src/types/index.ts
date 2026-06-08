// Stringified integer count of travellers, "1".."10". Kept as a string to
// match the Prisma `travelers String?` column and the Python agent wire format;
// the 1-10 bound is enforced by the Zod schema in routes/trips.ts.
export type TravelerCount = string;

export type AccommodationType =
  | 'Boutique Villa'
  | 'Luxury Hotel'
  | 'Eco Lodge'
  | 'Homestay'
  | 'Airbnb'
  | 'Hostel'
  | 'Custom Stay';

export type PaceType = 'Slow & Soulful' | 'Balanced' | 'Action-Packed';

export type BudgetTier = 'Low' | 'Medium' | 'High' | 'Very-High';

export type TripStatus = 'researching' | 'ready' | 'active' | 'completed' | 'archived';

export type SourceType = 'youtube' | 'reddit' | 'blog' | 'maps';

export type ResearchJobStatus = 'pending' | 'researching' | 'building' | 'completed' | 'failed';

export interface CreateTripBody {
  destination: string;
  date_from?: string | null;
  date_to?: string | null;
  duration_days?: number;
  travelers?: TravelerCount;
  vibes?: string[];
  accommodation?: AccommodationType;
  pace?: PaceType;
  budget?: BudgetTier;
  preferences?: string;
}

export interface ResearchDiscovery {
  id: string;
  title: string;
  body: string;
  tags: string[];
  source: SourceType;
}
