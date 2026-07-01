/* eslint-disable i18next/no-literal-string -- PDF content is intentionally French-only (Moroccan medical regulatory format) */
/**
 * Prescription PDF generation using @react-pdf/renderer.
 *
 * INSTALL FIRST:  npm install @react-pdf/renderer
 *
 * Uses a dynamic import so the module compiles even before the package is
 * installed and so the heavy renderer is never bundled into the edge runtime.
 * Call this only from Node.js API routes (not middleware or edge functions).
 */

interface PrescriptionMedication {
  name: string;
  dose: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionData {
  doctor: { name: string; speciality?: string };
  patient: { name: string; dateOfBirth?: string };
  clinic: { name: string; address?: string; phone?: string };
  medications: PrescriptionMedication[];
  notes?: string;
  date: string; // ISO timestamp
}

/**
 * Generate an A5 PDF buffer for a prescription.
 * Throws if @react-pdf/renderer is not installed.
 */
export async function generatePrescriptionPDF(data: PrescriptionData): Promise<Buffer> {
  // Dynamic import keeps this out of the edge bundle and defers the error
  // to runtime (with a clear message) when the package isn't installed yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any;
  try {
    // Indirect import keeps TypeScript from resolving the module at compile
    // time — the package is intentionally optional and only installed when
    // PDF generation is needed in production.
    const moduleName = "@react-pdf/renderer";

    r = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)(moduleName);
  } catch {
    throw new Error(
      "generatePrescriptionPDF: @react-pdf/renderer is not installed.\n" +
        "Run: npm install @react-pdf/renderer",
    );
  }

  const { Document, Page, Text, View, StyleSheet, pdf } = r;

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
    header: { marginBottom: 20, paddingBottom: 10, borderBottom: "1pt solid #cccccc" },
    title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
    section: { marginTop: 16 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    med: { flexDirection: "row", marginBottom: 8, gap: 8 },
    label: { fontWeight: "bold", width: 120 },
    sigLine: { marginTop: 40 },
    sigRule: { marginTop: 20, borderTop: "0.5pt solid #999999", width: 120 },
  });

  const formattedDate = new Date(data.date).toLocaleDateString("fr-MA");

  const doc = (
    <Document>
      <Page size="A5" style={styles.page}>
        {/* Clinic / doctor header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dr. {data.doctor.name}</Text>
          {data.doctor.speciality ? <Text>{data.doctor.speciality}</Text> : null}
          <Text>{data.clinic.name}</Text>
          {data.clinic.address ? <Text>{data.clinic.address}</Text> : null}
          {data.clinic.phone ? <Text>Tél : {data.clinic.phone}</Text> : null}
        </View>

        {/* Patient + date */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text>Patient : {data.patient.name}</Text>
            <Text>Date : {formattedDate}</Text>
          </View>
          {data.patient.dateOfBirth ? <Text>Né(e) le : {data.patient.dateOfBirth}</Text> : null}
        </View>

        {/* Medications */}
        <View style={styles.section}>
          <Text style={{ fontWeight: "bold", marginBottom: 8 }}>Ordonnance</Text>
          {data.medications.map((med, i) => (
            <View key={i} style={styles.med}>
              <Text style={styles.label}>{med.name}</Text>
              <Text>
                {med.dose} — {med.duration} — {med.instructions}
              </Text>
            </View>
          ))}
        </View>

        {/* Notes */}
        {data.notes ? (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {/* Signature */}
        <View style={styles.sigLine}>
          <Text>Signature du médecin :</Text>
          <View style={styles.sigRule} />
        </View>
      </Page>
    </Document>
  );

  return pdf(doc).toBuffer();
}
