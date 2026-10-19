import { z } from "zod";

const text = () => z.string().trim().default("");

// Patient-level case record. Each snapshot is linked to the consultation it
// was recorded in (see docs/superpowers/specs/2026-10-19-generals-lsmc-design.md).
export const generalsSchema = z.object({
  appetite: text(),
  thirst: text(),
  bladder: text(),
  bowel: text(),
  sleepDreams: text(),
  lmp: z.number().int().nullable().default(null),
  menarche: text(),
  menopause: text(),
  menstrualPain: text(),
  clots: text(),
  moodSwings: text(),
  leucorrhoea: text(),
  perspirationOdour: text(),
  perspirationStaining: text(),
  perspirationRemarks: text(),
  sexualHistory: text(),
  pastHistory: text(),
  mentals: text(),
  allergicHistory: text(),
});

export type Generals = z.infer<typeof generalsSchema>;

export const EMPTY_GENERALS: Generals = generalsSchema.parse({});

export const GENERALS_KEYS = Object.keys(EMPTY_GENERALS) as (keyof Generals)[];

export const lsmcRowSchema = z.object({
  id: z.string().optional(),
  location: text(),
  sensation: text(),
  modality: text(),
  concomitant: text(),
});

export type LsmcRowInput = z.infer<typeof lsmcRowSchema>;

export interface GeneralsRecord extends Generals {
  id: string;
  patientId: string;
  consultationId: string;
  date: number;
  updatedAt: number;
}

export interface LsmcRow {
  id: string;
  patientId: string;
  consultationId: string;
  date: number;
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
  createdAt: number;
}

/** `generals: null` means "leave this visit's generals alone". */
export type CaseRecordInput = {
  generals: Generals | null;
  lsmc: LsmcRowInput[];
};

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export function isGeneralsBlank(g: Generals): boolean {
  return GENERALS_KEYS.every((k) =>
    k === "lmp" ? g.lmp == null : !norm(g[k]),
  );
}

export function isLsmcRowBlank(
  r: Pick<LsmcRowInput, "location" | "sensation" | "modality" | "concomitant">,
): boolean {
  return [r.location, r.sensation, r.modality, r.concomitant].every(
    (v) => !norm(v),
  );
}
