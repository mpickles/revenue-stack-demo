// Values for the /demo employees select. Labels are what the visitor sees.
export const EMPLOYEE_BANDS = [
  { value: "1-49", label: "1–49" },
  { value: "50-199", label: "50–199" },
  { value: "200-999", label: "200–999" },
  { value: "1000-4999", label: "1,000–4,999" },
  { value: "5000+", label: "5,000+" },
] as const;

export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number]["value"];
