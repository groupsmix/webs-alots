export { getClinicAnalytics } from "./clinic";
export type {
  ClinicAnalyticsQuery,
  ClinicAnalyticsSummary,
  AppointmentMetrics,
  PatientAcquisitionMetrics,
  RevenueMetrics,
  StaffMetrics,
} from "./clinic";

export { getPatientAnalytics } from "./patient";
export type {
  PatientAnalyticsQuery,
  PatientAnalyticsSummary,
  EngagementMetrics,
  AppointmentHistoryEntry,
} from "./patient";

export { getFinancialReport } from "./financial";
export type {
  FinancialReportQuery,
  FinancialSummary,
  RevenueBreakdown,
  AccountsReceivableEntry,
} from "./financial";
