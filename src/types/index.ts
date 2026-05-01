export type TravelerCount = '1' | '2' | '3+' | 'large';

export type AccommodationType =
  | 'Boutique Villa'
  | 'Luxury Hotel'
  | 'Eco Lodge'
  | 'Homestay'
  | 'Airbnb'
  | 'Hostel'
  | 'Custom Stay';

export type PaceType = 'Slow & Soulful' | 'Balanced' | 'Action-Packed';

export type BudgetTier = '$' | '$$' | '$$$' | '$$$$';

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
