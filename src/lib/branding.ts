import { getDoc, setDoc } from "firebase/firestore";
import { DEFAULT_BRAND } from "../theme/brand";
import { clinicDoc } from "./clinic";

export interface Contact {
  doctorName: string;
  qualifications: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
}

export interface Branding {
  displayName: string;
  logoDataUrl: string;
  primaryColor: string;
  showScripture: boolean;
  contact: Contact;
}

export const EMPTY_CONTACT: Contact = {
  doctorName: "",
  qualifications: "",
  registrationNo: "",
  address: "",
  phone: "",
  email: "",
};

export const DEFAULT_BRANDING: Branding = {
  displayName: "",
  logoDataUrl: "",
  primaryColor: DEFAULT_BRAND,
  showScripture: true,
  contact: EMPTY_CONTACT,
};

const SETTINGS = "settings";
const BRANDING_ID = "branding";

const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);

function merge(data: unknown): Branding {
  const o = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const c = (
    o.contact && typeof o.contact === "object" && !Array.isArray(o.contact)
      ? o.contact
      : {}
  ) as Record<string, unknown>;
  return {
    displayName: str(o.displayName, DEFAULT_BRANDING.displayName),
    logoDataUrl: str(o.logoDataUrl, DEFAULT_BRANDING.logoDataUrl),
    primaryColor:
      typeof o.primaryColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(o.primaryColor)
        ? o.primaryColor
        : DEFAULT_BRANDING.primaryColor,
    showScripture:
      typeof o.showScripture === "boolean"
        ? o.showScripture
        : DEFAULT_BRANDING.showScripture,
    contact: {
      doctorName: str(c.doctorName, ""),
      qualifications: str(c.qualifications, ""),
      registrationNo: str(c.registrationNo, ""),
      address: str(c.address, ""),
      phone: str(c.phone, ""),
      email: str(c.email, ""),
    },
  };
}

export async function getBranding(clinicId: string): Promise<Branding> {
  const snap = await getDoc(clinicDoc(SETTINGS, BRANDING_ID, clinicId));
  if (!snap.exists()) return DEFAULT_BRANDING;
  return merge(snap.data());
}

export async function saveBranding(
  clinicId: string,
  b: Branding,
  by: string,
): Promise<void> {
  await setDoc(clinicDoc(SETTINGS, BRANDING_ID, clinicId), {
    displayName: b.displayName,
    logoDataUrl: b.logoDataUrl,
    primaryColor: b.primaryColor,
    showScripture: b.showScripture,
    contact: b.contact,
    updatedAt: Date.now(),
    updatedBy: by,
  });
}

const cacheKey = (clinicId: string) => `homoeodesk.branding.${clinicId}`;

export function readCachedBranding(clinicId: string): Branding | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(clinicId));
    if (!raw) return undefined;
    return merge(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function writeCachedBranding(clinicId: string, b: Branding): void {
  try {
    localStorage.setItem(cacheKey(clinicId), JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

export function displayNameOf(
  b: Branding | undefined,
  clinicName: string | undefined,
): string {
  const n = typeof b?.displayName === "string" ? b.displayName.trim() : "";
  return n || clinicName || "Grace Medica";
}
