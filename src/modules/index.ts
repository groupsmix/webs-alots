/**
 * Domain-Driven Design Module Architecture
 *
 * Adapted from Helsa's modular architecture. Each module encapsulates
 * a bounded context with its own types, business logic, and data access.
 *
 * Module structure:
 *   src/modules/
 *     fhir/          — EHR interoperability (FHIR R4 proxy boundary)
 *     vitals/        — Real-time vital signs streaming (SSE)
 *     audit/         — Append-only immutable audit logging
 *     prescription/  — Prescription lifecycle workflow
 *
 * Conventions:
 *   - Each module has an index.ts barrel export
 *   - Types are co-located in types/ subdirectory
 *   - Business logic in domain files (workflow.ts, stream.ts, etc.)
 *   - External integrations in boundary/ subdirectory
 *   - All DB operations must include .eq('clinic_id', clinicId)
 */

export * as fhir from "./fhir";
export * as vitals from "./vitals";
export * as audit from "./audit";
export * as prescription from "./prescription";
