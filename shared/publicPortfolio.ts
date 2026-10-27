export const portfolioStatusFilters = [
  { value: "all", label: "전체" },
  { value: "merged", label: "병합됨" },
  { value: "open", label: "진행 중" },
  { value: "closed", label: "닫힘" }
] as const;

export type PortfolioStatusFilter = typeof portfolioStatusFilters[number]["value"];

export const isPortfolioStatusFilter = (value: unknown): value is PortfolioStatusFilter => (
  portfolioStatusFilters.some(option => option.value === value)
);

export const parsePortfolioStatuses = (parameters: URLSearchParams): PortfolioStatusFilter[] | null => {
  const requested = parameters.getAll("status");
  if (!requested.length) return ["merged"];
  return requested.every(isPortfolioStatusFilter) ? [...new Set(requested)] : null;
};
