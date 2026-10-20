import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDoc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { listFutureAppointments, type Appointment } from "./appointments";
import { clinicDoc } from "./clinic";
import { dayStartInZone, weekdayKeyOf, zonedTimeToMs } from "./zonedDates";

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Session {
  start: string;
  end: string;
}
export interface Holiday {
  date: number;
  note: string;
}
export interface Schedule {
  slotMinutes: number;
  weekly: Record<Weekday, Session[]>;
  holidays: Holiday[];
}

export const SLOT_CHOICES = [10, 15, 20, 30, 45, 60];

const emptyWeek = (): Record<Weekday, Session[]> => ({
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
});

export const DEFAULT_SCHEDULE: Schedule = {
  slotMinutes: 15,
  weekly: emptyWeek(),
  holidays: [],
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const sessionSchema = z
  .object({ start: hhmm, end: hhmm })
  .refine((x) => x.start < x.end, { message: "start must be before end" });

const daySchema = z
  .array(sessionSchema)
  .max(3)
  .refine(
    (list) => {
      const sorted = [...list].sort((a, b) =>
        a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
      );
      return sorted.every((x, i) => i === 0 || sorted[i - 1].end <= x.start);
    },
    { message: "sessions overlap" },
  );

export const scheduleSchema = z.object({
  slotMinutes: z.number().int().min(5).max(120),
  weekly: z.object({
    mon: daySchema,
    tue: daySchema,
    wed: daySchema,
    thu: daySchema,
    fri: daySchema,
    sat: daySchema,
    sun: daySchema,
  }),
  holidays: z
    .array(z.object({ date: z.number().int(), note: z.string().max(60) }))
    .max(100),
});

export function hasHours(s: Schedule): boolean {
  return WEEKDAYS.some((d) => s.weekly[d].length > 0);
}

export function holidayOn(dayStart: number, s: Schedule): Holiday | undefined {
  return s.holidays.find((h) => h.date === dayStart);
}

export function slotsForDay(
  dayStart: number,
  s: Schedule,
  tz: string,
  opts: { ignoreHolidays?: boolean } = {},
): { start: number; end: number }[] {
  if (!opts.ignoreHolidays && holidayOn(dayStart, s)) return [];
  const step = s.slotMinutes * 60_000;
  const sessions = [...s.weekly[weekdayKeyOf(dayStart, tz)]].sort((a, b) =>
    a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
  );
  const out: { start: number; end: number }[] = [];
  for (const sess of sessions) {
    const sessEnd = zonedTimeToMs(dayStart, sess.end, tz);
    for (
      let t = zonedTimeToMs(dayStart, sess.start, tz);
      t + step <= sessEnd;
      t += step
    ) {
      out.push({ start: t, end: t + step });
    }
  }
  return out;
}

/** Appointments whose exact start/end is not a slot of the current grid (holidays ignored). */
export function offGridAppointments<T extends { start: number; end: number }>(
  appts: T[],
  s: Schedule,
  tz: string,
): T[] {
  return appts.filter((a) => {
    const slots = slotsForDay(dayStartInZone(a.start, tz), s, tz, {
      ignoreHolidays: true,
    });
    return !slots.some((x) => x.start === a.start && x.end === a.end);
  });
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Merge stored data over DEFAULT_SCHEDULE, tolerating missing or malformed keys. */
export function parseSchedule(data: unknown): Schedule {
  const o = isObj(data) ? data : {};
  const w = isObj(o.weekly) ? o.weekly : {};
  const weekly = emptyWeek();
  for (const d of WEEKDAYS) {
    const list = w[d];
    if (!Array.isArray(list)) continue;
    weekly[d] = list.flatMap((x) =>
      isObj(x) && typeof x.start === "string" && typeof x.end === "string"
        ? [{ start: x.start, end: x.end }]
        : [],
    );
  }
  const holidays = Array.isArray(o.holidays)
    ? o.holidays.flatMap((h) =>
        isObj(h) && typeof h.date === "number"
          ? [{ date: h.date, note: typeof h.note === "string" ? h.note : "" }]
          : [],
      )
    : [];
  const sm = o.slotMinutes;
  return {
    slotMinutes:
      typeof sm === "number" && Number.isInteger(sm) && sm >= 5 && sm <= 120
        ? sm
        : DEFAULT_SCHEDULE.slotMinutes,
    weekly,
    holidays,
  };
}

const SETTINGS = "settings";
const SCHEDULE_ID = "schedule";

export async function getSchedule(clinicId: string): Promise<Schedule> {
  const snap = await getDoc(clinicDoc(SETTINGS, SCHEDULE_ID, clinicId));
  if (!snap.exists()) return DEFAULT_SCHEDULE;
  return parseSchedule(snap.data());
}

export class OffGridError extends Error {
  appointments: Appointment[];
  constructor(appointments: Appointment[]) {
    super("Some upcoming appointments would no longer fit the new hours");
    this.name = "OffGridError";
    this.appointments = appointments;
  }
}

export async function saveSchedule(
  clinicId: string,
  s: Schedule,
  by: string,
  tz: string,
  now: number = Date.now(),
): Promise<void> {
  const today = dayStartInZone(now, tz);
  const next: Schedule = {
    ...s,
    holidays: s.holidays.filter((h) => h.date >= today),
  };
  const off = offGridAppointments(
    await listFutureAppointments(clinicId, now),
    next,
    tz,
  );
  if (off.length > 0) throw new OffGridError(off);
  await setDoc(clinicDoc(SETTINGS, SCHEDULE_ID, clinicId), {
    slotMinutes: next.slotMinutes,
    weekly: next.weekly,
    holidays: next.holidays,
    updatedAt: now,
    updatedBy: by,
  });
}

export function useSchedule(clinicId: string | undefined) {
  return useQuery({
    queryKey: ["schedule", clinicId],
    queryFn: () => getSchedule(clinicId as string),
    enabled: !!clinicId,
  });
}

export function useSaveSchedule(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      schedule,
      by,
      tz,
    }: {
      schedule: Schedule;
      by: string;
      tz: string;
    }) => saveSchedule(clinicId, schedule, by, tz),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule", clinicId] }),
  });
}
