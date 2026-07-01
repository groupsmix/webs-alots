// Intentionally empty.
//
// `lucide-react` and `ai` (Vercel AI SDK) both ship their own complete type
// definitions, so no ambient `declare module` shims are needed. Previously this
// file declared those packages as untyped modules, which silently turned the
// entire AI SDK + icon surface into `any` and defeated the `tsc` gate (see audit
// finding R-1/R-4). Removing the shims restores real type checking — critical
// after the `ai` v6 -> v7 major bump.
export {};
