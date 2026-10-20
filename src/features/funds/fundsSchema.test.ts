import { summarizePeriod } from "./fundsSchema";

test("summarizePeriod counts salaries in expenses and balance", () => {
  expect(
    summarizePeriod(
      [{ amount: 1000, paymentMode: "Cash" }],
      [{ amount: 200 }],
      300,
    ),
  ).toMatchObject({
    totalIncome: 1000,
    totalExpenses: 500,
    totalSalaries: 300,
    balance: 500,
  });
});

test("summarizePeriod defaults salaries to 0", () => {
  expect(summarizePeriod([], [{ amount: 200 }])).toMatchObject({
    totalExpenses: 200,
    totalSalaries: 0,
    balance: -200,
  });
});
