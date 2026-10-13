export type Placement = "HOME" | "MEDIA" | "CONTENT" | "PARTNERS";
export interface AdSettings {
  partners_enabled: boolean;
  google_enabled: boolean;
  test_mode: boolean;
  hide_for_premium: boolean;
  admob_banner_id: string;
  adsense_enabled: boolean;
  adsense_client: string;
  adsense_slot: string;
  google_placements: Placement[];
  contact_email: string;
}
export interface Partner {
  id: number;
  name: string;
  description: string;
  website: string;
  logo_url: string | null;
}
export interface Campaign {
  id: number;
  partner_id: number;
  partner_name: string;
  title: string;
  description: string;
  image_url: string | null;
  logo_url: string | null;
  url: string;
  cta: string;
  placements: Placement[];
}
export interface AdvertisingData {
  settings: AdSettings;
  partners: Partner[];
  banners: Campaign[];
}
