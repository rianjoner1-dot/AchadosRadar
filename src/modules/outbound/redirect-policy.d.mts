export interface RedirectProduct {
  platform: string;
  status: string;
}

export interface RedirectLink {
  affiliate_url: string;
  status: string;
  verified_at?: string | null;
  expires_at?: string | null;
  refresh_due_at?: string | null;
}

export interface RedirectOffer {
  stock_status?: string | null;
  observed_at?: string | null;
}

export type AffiliateRedirectDecision =
  | { ready: false; status: 409 | 410; message: string }
  | { ready: true; status: 302; location: string };

export function evaluateAffiliateRedirect(input: {
  product?: RedirectProduct | null;
  link?: RedirectLink | null;
  offer?: RedirectOffer | null;
  now?: number;
}): AffiliateRedirectDecision;
