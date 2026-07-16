"use client";

import { AlertTriangle, CheckCircle, CreditCard, FileText, Loader2, Shield } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocale } from "@/components/locale-switcher";

type InsuranceType = "cnss" | "cnops" | "amo" | "ramed" | "private" | "none";

interface InsuranceProfile {
  insuranceType: InsuranceType;
  membershipNumber: string | null;
  coveragePercentage: number;
  requiresPreApproval: boolean;
  formTemplate: string;
  copayEstimate: number;
  notes: string[];
}

const insuranceLabels: Record<InsuranceType, Record<string, string>> = {
  cnss: { fr: "CNSS", ar: "CNSS" },
  cnops: { fr: "CNOPS", ar: "CNOPS" },
  amo: { fr: "AMO", ar: "AMO" },
  ramed: { fr: "RAMED", ar: "راميد" },
  private: { fr: "Assurance privée", ar: "تأمين خاص" },
  none: { fr: "Sans couverture", ar: "بدون تغطية" },
};

const insuranceColors: Record<InsuranceType, string> = {
  cnss: "bg-blue-100 text-blue-800 border-blue-300",
  cnops: "bg-indigo-100 text-indigo-800 border-indigo-300",
  amo: "bg-purple-100 text-purple-800 border-purple-300",
  ramed: "bg-green-100 text-green-800 border-green-300",
  private: "bg-cyan-100 text-cyan-800 border-cyan-300",
  none: "bg-gray-100 text-gray-800 border-gray-300",
};

const insuranceTypes: InsuranceType[] = ["cnss", "cnops", "amo", "ramed", "private", "none"];

export function PatientFinanceView() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";
  const isRtl = lang === "ar";

  const [patientId, setPatientId] = useState("");
  const [profile, setProfile] = useState<InsuranceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editType, setEditType] = useState<InsuranceType>("none");
  const [editNumber, setEditNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!patientId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patient/insurance-profile?patient_id=${encodeURIComponent(patientId)}&language=${lang}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: { profile: InsuranceProfile };
        error?: string;
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? (lang === "ar" ? "مريض غير موجود" : "Patient non trouvé"));
        return;
      }
      setProfile(json.data.profile);
      setEditType(json.data.profile.insuranceType);
      setEditNumber(json.data.profile.membershipNumber ?? "");
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [patientId, lang]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/insurance-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          insuranceType: editType,
          insuranceNumber: editNumber || null,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? (lang === "ar" ? "خطأ في الحفظ" : "Erreur de sauvegarde"));
        return;
      }
      setEditMode(false);
      void fetchProfile();
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-6 ${isRtl ? "text-end" : ""}`} dir={isRtl ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-bold text-gray-900">
        <CreditCard className="me-2 inline-block h-6 w-6" />
        {lang === "ar" ? "الملف المالي للمريض" : "Profil financier du patient"}
      </h1>

      {/* Patient ID input */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder={lang === "ar" ? "معرف المريض (UUID)" : "ID du patient (UUID)"}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="flex-1 rounded-lg border px-4 py-2 text-sm"
        />
        <button
          onClick={() => void fetchProfile()}
          disabled={loading || !patientId.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : lang === "ar" ? (
            "بحث"
          ) : (
            "Rechercher"
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          {/* Insurance type badge */}
          <div className={`rounded-xl border-2 p-6 ${insuranceColors[profile.insuranceType]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-80">
                    {lang === "ar" ? "نوع التأمين" : "Type d'assurance"}
                  </p>
                  <p className="text-2xl font-bold">
                    {insuranceLabels[profile.insuranceType]?.[lang] ?? profile.insuranceType}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-sm opacity-80">
                  {lang === "ar" ? "نسبة التغطية" : "Couverture"}
                </p>
                <p className="text-3xl font-bold">{profile.coveragePercentage}%</p>
              </div>
            </div>
            {profile.membershipNumber && (
              <p className="mt-3 text-sm">
                {lang === "ar" ? "رقم العضوية:" : "N° adhérent:"}{" "}
                <span className="font-mono font-bold">{profile.membershipNumber}</span>
              </p>
            )}
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm">{lang === "ar" ? "حصة المريض" : "Part patient"}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{profile.copayEstimate}%</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <FileText className="h-4 w-4" />
                <span className="text-sm">{lang === "ar" ? "النموذج" : "Formulaire"}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {profile.formTemplate.replace(/_/g, " ")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-gray-600">
                {profile.requiresPreApproval ? (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm">
                  {lang === "ar" ? "موافقة مسبقة" : "Accord préalable"}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {profile.requiresPreApproval
                  ? lang === "ar"
                    ? "مطلوب"
                    : "Requis"
                  : lang === "ar"
                    ? "غير مطلوب"
                    : "Non requis"}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              {lang === "ar" ? "ملاحظات مهمة" : "Notes importantes"}
            </h2>
            <ul className="space-y-2">
              {profile.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Edit insurance */}
          {editMode ? (
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <h3 className="font-semibold">
                {lang === "ar" ? "تعديل التأمين" : "Modifier l'assurance"}
              </h3>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as InsuranceType)}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                {insuranceTypes.map((type) => (
                  <option key={type} value={type}>
                    {insuranceLabels[type]?.[lang] ?? type}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={lang === "ar" ? "رقم العضوية" : "N° adhérent"}
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? lang === "ar"
                      ? "جاري الحفظ..."
                      : "Enregistrement..."
                    : lang === "ar"
                      ? "حفظ"
                      : "Enregistrer"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  {lang === "ar" ? "إلغاء" : "Annuler"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {lang === "ar" ? "تعديل نوع التأمين" : "Modifier le type d'assurance"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
