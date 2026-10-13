export type RiskLevel = 'low' | 'medium' | 'high';

export interface SafetyReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  headline: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface TripSummary {
  headline: string;
  summary: string;
  riskLevel: RiskLevel;
  highlights: string[];
}

export type ComplaintCategory =
  | 'Rash Driving'
  | 'Overspeeding'
  | 'Route Issue'
  | 'Delay'
  | 'Vehicle Condition'
  | 'Behaviour'
  | 'Other';

export interface ComplaintAnalysis {
  category: ComplaintCategory;
  severity: RiskLevel;
  summary: string;
  suggestedAction: string;
}

export interface WeeklyInsight {
  title: string;
  detail: string;
  trend: 'up' | 'down' | 'flat';
}
