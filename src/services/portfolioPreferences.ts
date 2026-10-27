import { isPortfolioStatusFilter } from "../../shared/publicPortfolio";
import type { PortfolioStatusFilter } from "../../shared/publicPortfolio";

const storageKey = (login: string) => `giyeoro:portfolio-statuses:${login.toLowerCase()}`;

export const readPortfolioStatuses = (login: string): PortfolioStatusFilter[] => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(login)) || "null");
    if (Array.isArray(saved) && saved.every(isPortfolioStatusFilter)) return [...new Set(saved)];
  } catch { /* Storage may be unavailable. */ }
  return ["merged"];
};

export const savePortfolioStatuses = (login: string, statuses: PortfolioStatusFilter[]) => {
  try { localStorage.setItem(storageKey(login), JSON.stringify(statuses)); } catch { /* Keep the in-memory selection. */ }
};

export const buildPortfolioPath = (login: string, statuses: PortfolioStatusFilter[]) => {
  const parameters = new URLSearchParams();
  statuses.forEach(status => parameters.append("status", status));
  return `/portfolio/${encodeURIComponent(login)}?${parameters}`;
};
