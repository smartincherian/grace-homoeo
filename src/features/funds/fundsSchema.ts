import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Medicines",
  "Rent",
  "Utilities",
  "Salary",
  "Equipment",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseFormSchema = z.object({
  date: z
    .number({
      required_error: "Date is required",
      invalid_type_error: "Date is required",
    })
    .int()
    .nonnegative(),
  category: z.enum(EXPENSE_CATEGORIES, {
    required_error: "Category is required",
  }),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .nonnegative("Amount cannot be negative"),
  note: z.string().trim().default(""),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export interface Expense extends ExpenseFormValues {
  id: string;
  createdAt: number;
}

/** A consultation reduced to just the fields Funds needs for income totals. */
export interface IncomeRecord {
  amount: number;
  paymentMode: string;
  date: number;
}

export interface PeriodSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  /** Income split by payment mode (e.g. Cash, UPI, Debt, No Fees), highest first. */
  incomeByMode: { mode: string; amount: number }[];
}

/**
 * Pure aggregation: total income (sum of consultation amounts), total expenses,
 * balance (income − expenses), and an income breakdown by payment mode so Debt /
 * No Fees stay visible separately from cash received.
 */
export function summarizePeriod(
  income: Pick<IncomeRecord, "amount" | "paymentMode">[],
  expenses: Pick<Expense, "amount">[],
): PeriodSummary {
  const totalIncome = income.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byMode = new Map<string, number>();
  for (const r of income) {
    byMode.set(r.paymentMode, (byMode.get(r.paymentMode) ?? 0) + r.amount);
  }
  const incomeByMode = [...byMode.entries()]
    .map(([mode, amount]) => ({ mode, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    incomeByMode,
  };
}
