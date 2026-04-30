/**
 * DCI Drug Database — Top 200 Moroccan Drugs
 *
 * Contains commonly prescribed medications in Morocco with their
 * DCI (Dénomination Commune Internationale / INN) names, brand names,
 * available dosage forms, strengths, and therapeutic categories.
 *
 * Data sources: Moroccan Ministry of Health formulary, ANAM reimbursement list.
 */

// ---- Types ----

export interface DCIDrug {
  /** Unique identifier */
  id: string;
  /** DCI / INN (generic) name */
  dci: string;
  /** Common brand names available in Morocco */
  brands: string[];
  /** Therapeutic category */
  category: DCIDrugCategory;
  /** Available dosage forms */
  forms: string[];
  /** Available strengths */
  strengths: string[];
  /** Whether this requires a prescription */
  requiresPrescription: boolean;
}

export type DCIDrugCategory =
  | "analgesic"
  | "antibiotic"
  | "antidiabetic"
  | "antihypertensive"
  | "antihistamine"
  | "anti-inflammatory"
  | "antifungal"
  | "antiviral"
  | "anxiolytic"
  | "antidepressant"
  | "antipsychotic"
  | "anticoagulant"
  | "antiplatelet"
  | "bronchodilator"
  | "cardiac"
  | "corticosteroid"
  | "dermatology"
  | "diuretic"
  | "gastrointestinal"
  | "hormone"
  | "lipid-lowering"
  | "muscle-relaxant"
  | "ophthalmic"
  | "respiratory"
  | "supplement"
  | "thyroid"
  | "urological"
  | "antiemetic"
  | "antiepileptic"
  | "antiparasitic"
  | "vaccine"
  | "other";

export const CATEGORY_LABELS: Record<DCIDrugCategory, string> = {
  analgesic: "Analgésique / Antalgique",
  antibiotic: "Antibiotique",
  antidiabetic: "Antidiabétique",
  antihypertensive: "Antihypertenseur",
  antihistamine: "Antihistaminique",
  "anti-inflammatory": "Anti-inflammatoire",
  antifungal: "Antifongique",
  antiviral: "Antiviral",
  anxiolytic: "Anxiolytique / Sédatif",
  antidepressant: "Antidépresseur",
  antipsychotic: "Antipsychotique",
  anticoagulant: "Anticoagulant",
  antiplatelet: "Antiplaquettaire",
  bronchodilator: "Bronchodilatateur",
  cardiac: "Cardiologie",
  corticosteroid: "Corticostéroïde",
  dermatology: "Dermatologie",
  diuretic: "Diurétique",
  gastrointestinal: "Gastro-intestinal",
  hormone: "Hormone",
  "lipid-lowering": "Hypolipémiant",
  "muscle-relaxant": "Myorelaxant",
  ophthalmic: "Ophtalmologie",
  respiratory: "Respiratoire",
  supplement: "Supplément / Vitamine",
  thyroid: "Thyroïde",
  urological: "Urologie",
  antiemetic: "Antiémétique",
  antiepileptic: "Antiépileptique",
  antiparasitic: "Antiparasitaire",
  vaccine: "Vaccin",
  other: "Autre",
};

// ---- Drug Database ----

export const DCI_DRUG_DATABASE: DCIDrug[] = [
  // ── Analgesics / Pain ──
  { id: "d001", dci: "Paracétamol", brands: ["Doliprane", "Efferalgan", "Dafalgan"], category: "analgesic", forms: ["Comprimé", "Sachet", "Suppositoire", "Sirop"], strengths: ["500mg", "1g", "100mg", "150mg", "200mg", "300mg"], requiresPrescription: false },
  { id: "d002", dci: "Ibuprofène", brands: ["Brufen", "Advil", "Nurofen"], category: "anti-inflammatory", forms: ["Comprimé", "Gélule", "Sirop", "Gel"], strengths: ["200mg", "400mg", "600mg"], requiresPrescription: false },
  { id: "d003", dci: "Diclofénac", brands: ["Voltarène", "Cataflam"], category: "anti-inflammatory", forms: ["Comprimé", "Gel", "Suppositoire", "Injectable"], strengths: ["25mg", "50mg", "75mg", "100mg", "1%"], requiresPrescription: true },
  { id: "d004", dci: "Tramadol", brands: ["Tramal", "Contramal", "Topalgic"], category: "analgesic", forms: ["Gélule", "Comprimé LP", "Gouttes", "Injectable"], strengths: ["50mg", "100mg", "150mg", "200mg"], requiresPrescription: true },
  { id: "d005", dci: "Codéine + Paracétamol", brands: ["Codoliprane", "Dafalgan Codéiné"], category: "analgesic", forms: ["Comprimé"], strengths: ["400mg/20mg", "500mg/30mg"], requiresPrescription: true },
  { id: "d006", dci: "Acide Acétylsalicylique", brands: ["Aspro", "Aspégic", "Kardégic"], category: "analgesic", forms: ["Comprimé", "Sachet"], strengths: ["75mg", "100mg", "250mg", "500mg", "1g"], requiresPrescription: false },
  { id: "d007", dci: "Kétoprofène", brands: ["Profénid", "Bi-Profénid"], category: "anti-inflammatory", forms: ["Comprimé", "Gélule", "Gel", "Injectable"], strengths: ["50mg", "100mg", "150mg LP", "2.5%"], requiresPrescription: true },
  { id: "d008", dci: "Naproxène", brands: ["Naprosyne", "Apranax"], category: "anti-inflammatory", forms: ["Comprimé", "Sachet"], strengths: ["250mg", "500mg", "550mg"], requiresPrescription: true },
  { id: "d009", dci: "Morphine", brands: ["Skénan", "Actiskénan"], category: "analgesic", forms: ["Gélule LP", "Gélule", "Injectable"], strengths: ["10mg", "30mg", "60mg", "100mg"], requiresPrescription: true },
  { id: "d010", dci: "Néfopam", brands: ["Acupan"], category: "analgesic", forms: ["Injectable", "Comprimé"], strengths: ["20mg"], requiresPrescription: true },

  // ── Antibiotics ──
  { id: "d011", dci: "Amoxicilline", brands: ["Clamoxyl", "Amoxil", "Ospamox"], category: "antibiotic", forms: ["Gélule", "Comprimé dispersible", "Sirop", "Injectable"], strengths: ["250mg", "500mg", "1g"], requiresPrescription: true },
  { id: "d012", dci: "Amoxicilline + Acide Clavulanique", brands: ["Augmentin", "Amoclav"], category: "antibiotic", forms: ["Comprimé", "Sachet", "Sirop", "Injectable"], strengths: ["500mg/62.5mg", "1g/125mg", "100mg/12.5mg/mL"], requiresPrescription: true },
  { id: "d013", dci: "Azithromycine", brands: ["Zithromax", "Azadose"], category: "antibiotic", forms: ["Comprimé", "Gélule", "Sirop"], strengths: ["250mg", "500mg", "200mg/5mL"], requiresPrescription: true },
  { id: "d014", dci: "Ciprofloxacine", brands: ["Ciproxine", "Cipro"], category: "antibiotic", forms: ["Comprimé", "Injectable", "Collyre"], strengths: ["250mg", "500mg", "750mg", "0.3%"], requiresPrescription: true },
  { id: "d015", dci: "Métronidazole", brands: ["Flagyl"], category: "antibiotic", forms: ["Comprimé", "Ovule", "Injectable", "Gel"], strengths: ["250mg", "500mg"], requiresPrescription: true },
  { id: "d016", dci: "Doxycycline", brands: ["Vibramycine", "Doxylis"], category: "antibiotic", forms: ["Comprimé", "Gélule"], strengths: ["100mg", "200mg"], requiresPrescription: true },
  { id: "d017", dci: "Céfixime", brands: ["Oroken"], category: "antibiotic", forms: ["Comprimé", "Sirop"], strengths: ["200mg", "400mg", "100mg/5mL"], requiresPrescription: true },
  { id: "d018", dci: "Lévofloxacine", brands: ["Tavanic"], category: "antibiotic", forms: ["Comprimé", "Injectable"], strengths: ["250mg", "500mg"], requiresPrescription: true },
  { id: "d019", dci: "Clarithromycine", brands: ["Zeclar", "Naxy"], category: "antibiotic", forms: ["Comprimé", "Sirop"], strengths: ["250mg", "500mg"], requiresPrescription: true },
  { id: "d020", dci: "Céftriaxone", brands: ["Rocéphine"], category: "antibiotic", forms: ["Injectable IM/IV"], strengths: ["250mg", "500mg", "1g", "2g"], requiresPrescription: true },
  { id: "d021", dci: "Cotrimoxazole", brands: ["Bactrim", "Eusaprim"], category: "antibiotic", forms: ["Comprimé", "Sirop"], strengths: ["400mg/80mg", "800mg/160mg"], requiresPrescription: true },
  { id: "d022", dci: "Spiramycine", brands: ["Rovamycine"], category: "antibiotic", forms: ["Comprimé"], strengths: ["1.5 MUI", "3 MUI"], requiresPrescription: true },
  { id: "d023", dci: "Pristinamycine", brands: ["Pyostacine"], category: "antibiotic", forms: ["Comprimé"], strengths: ["250mg", "500mg"], requiresPrescription: true },
  { id: "d024", dci: "Gentamicine", brands: ["Gentalline"], category: "antibiotic", forms: ["Injectable", "Collyre", "Pommade"], strengths: ["10mg", "40mg", "80mg", "0.3%"], requiresPrescription: true },
  { id: "d025", dci: "Pénicilline V", brands: ["Oracilline"], category: "antibiotic", forms: ["Comprimé", "Sirop"], strengths: ["1 MUI", "500 000 UI"], requiresPrescription: true },

  // ── Antidiabetics ──
  { id: "d026", dci: "Metformine", brands: ["Glucophage", "Stagid"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["500mg", "850mg", "1000mg"], requiresPrescription: true },
  { id: "d027", dci: "Gliclazide", brands: ["Diamicron"], category: "antidiabetic", forms: ["Comprimé", "Comprimé LM"], strengths: ["30mg LM", "60mg LM", "80mg"], requiresPrescription: true },
  { id: "d028", dci: "Glibenclamide", brands: ["Daonil"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["2.5mg", "5mg"], requiresPrescription: true },
  { id: "d029", dci: "Sitagliptine", brands: ["Januvia", "Xelevia"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["25mg", "50mg", "100mg"], requiresPrescription: true },
  { id: "d030", dci: "Insuline Glargine", brands: ["Lantus", "Toujeo"], category: "antidiabetic", forms: ["Stylo injectable"], strengths: ["100 UI/mL", "300 UI/mL"], requiresPrescription: true },
  { id: "d031", dci: "Insuline Rapide", brands: ["Novorapid", "Humalog", "Apidra"], category: "antidiabetic", forms: ["Stylo injectable", "Flacon"], strengths: ["100 UI/mL"], requiresPrescription: true },
  { id: "d032", dci: "Vildagliptine", brands: ["Galvus"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["50mg"], requiresPrescription: true },
  { id: "d033", dci: "Empagliflozine", brands: ["Jardiance"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["10mg", "25mg"], requiresPrescription: true },

  // ── Antihypertensives ──
  { id: "d034", dci: "Amlodipine", brands: ["Amlor"], category: "antihypertensive", forms: ["Gélule", "Comprimé"], strengths: ["5mg", "10mg"], requiresPrescription: true },
  { id: "d035", dci: "Losartan", brands: ["Cozaar"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["50mg", "100mg"], requiresPrescription: true },
  { id: "d036", dci: "Valsartan", brands: ["Tareg", "Nisis"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["80mg", "160mg", "320mg"], requiresPrescription: true },
  { id: "d037", dci: "Ramipril", brands: ["Triatec"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["1.25mg", "2.5mg", "5mg", "10mg"], requiresPrescription: true },
  { id: "d038", dci: "Énalapril", brands: ["Renitec"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["5mg", "10mg", "20mg"], requiresPrescription: true },
  { id: "d039", dci: "Périndopril", brands: ["Coversyl"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["2.5mg", "5mg", "10mg"], requiresPrescription: true },
  { id: "d040", dci: "Atenolol", brands: ["Ténormine"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["50mg", "100mg"], requiresPrescription: true },
  { id: "d041", dci: "Bisoprolol", brands: ["Concor", "Cardensiel"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["1.25mg", "2.5mg", "5mg", "10mg"], requiresPrescription: true },
  { id: "d042", dci: "Nifédipine", brands: ["Adalate"], category: "antihypertensive", forms: ["Comprimé LP", "Capsule"], strengths: ["10mg", "20mg LP", "30mg LP"], requiresPrescription: true },
  { id: "d043", dci: "Irbésartan", brands: ["Aprovel"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["75mg", "150mg", "300mg"], requiresPrescription: true },
  { id: "d044", dci: "Telmisartan", brands: ["Micardis", "Pritor"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["40mg", "80mg"], requiresPrescription: true },
  { id: "d045", dci: "Captopril", brands: ["Lopril"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["25mg", "50mg"], requiresPrescription: true },

  // ── Antihistamines ──
  { id: "d046", dci: "Cétirizine", brands: ["Zyrtec", "Virlix"], category: "antihistamine", forms: ["Comprimé", "Sirop", "Gouttes"], strengths: ["10mg", "5mg/5mL"], requiresPrescription: false },
  { id: "d047", dci: "Desloratadine", brands: ["Aerius"], category: "antihistamine", forms: ["Comprimé", "Sirop"], strengths: ["5mg", "0.5mg/mL"], requiresPrescription: false },
  { id: "d048", dci: "Loratadine", brands: ["Clarityne"], category: "antihistamine", forms: ["Comprimé", "Sirop"], strengths: ["10mg", "5mg/5mL"], requiresPrescription: false },
  { id: "d049", dci: "Lévocétirizine", brands: ["Xyzall"], category: "antihistamine", forms: ["Comprimé", "Gouttes"], strengths: ["5mg"], requiresPrescription: false },
  { id: "d050", dci: "Bilastine", brands: ["Bilaxten"], category: "antihistamine", forms: ["Comprimé"], strengths: ["20mg"], requiresPrescription: false },

  // ── Gastrointestinal ──
  { id: "d051", dci: "Oméprazole", brands: ["Mopral", "Losec"], category: "gastrointestinal", forms: ["Gélule", "Injectable"], strengths: ["10mg", "20mg", "40mg"], requiresPrescription: true },
  { id: "d052", dci: "Ésoméprazole", brands: ["Inexium", "Nexium"], category: "gastrointestinal", forms: ["Comprimé", "Sachet", "Injectable"], strengths: ["20mg", "40mg"], requiresPrescription: true },
  { id: "d053", dci: "Lansoprazole", brands: ["Lanzor", "Ogast"], category: "gastrointestinal", forms: ["Gélule"], strengths: ["15mg", "30mg"], requiresPrescription: true },
  { id: "d054", dci: "Dompéridone", brands: ["Motilium", "Péridys"], category: "gastrointestinal", forms: ["Comprimé", "Sirop", "Suppositoire"], strengths: ["10mg", "1mg/mL"], requiresPrescription: false },
  { id: "d055", dci: "Métoclopramide", brands: ["Primpéran"], category: "antiemetic", forms: ["Comprimé", "Sirop", "Injectable"], strengths: ["10mg"], requiresPrescription: true },
  { id: "d056", dci: "Lopéramide", brands: ["Imodium"], category: "gastrointestinal", forms: ["Gélule", "Comprimé"], strengths: ["2mg"], requiresPrescription: false },
  { id: "d057", dci: "Smectite Dioctaédrique", brands: ["Smecta"], category: "gastrointestinal", forms: ["Sachet"], strengths: ["3g"], requiresPrescription: false },
  { id: "d058", dci: "Phloroglucinol", brands: ["Spasfon"], category: "gastrointestinal", forms: ["Comprimé", "Suppositoire", "Injectable"], strengths: ["80mg"], requiresPrescription: false },
  { id: "d059", dci: "Ranitidine", brands: ["Azantac", "Raniplex"], category: "gastrointestinal", forms: ["Comprimé", "Injectable"], strengths: ["150mg", "300mg"], requiresPrescription: true },
  { id: "d060", dci: "Pantoprazole", brands: ["Inipomp", "Eupantol"], category: "gastrointestinal", forms: ["Comprimé", "Injectable"], strengths: ["20mg", "40mg"], requiresPrescription: true },

  // ── Corticosteroids ──
  { id: "d061", dci: "Prednisolone", brands: ["Solupred"], category: "corticosteroid", forms: ["Comprimé", "Comprimé orodispersible", "Solution buvable"], strengths: ["5mg", "20mg"], requiresPrescription: true },
  { id: "d062", dci: "Prednisone", brands: ["Cortancyl"], category: "corticosteroid", forms: ["Comprimé"], strengths: ["1mg", "5mg", "20mg"], requiresPrescription: true },
  { id: "d063", dci: "Dexaméthasone", brands: ["Dectancyl"], category: "corticosteroid", forms: ["Comprimé", "Injectable"], strengths: ["0.5mg", "4mg", "8mg"], requiresPrescription: true },
  { id: "d064", dci: "Bétaméthasone", brands: ["Célestène", "Diprostène"], category: "corticosteroid", forms: ["Comprimé", "Gouttes", "Injectable"], strengths: ["0.5mg", "2mg", "0.05%"], requiresPrescription: true },
  { id: "d065", dci: "Hydrocortisone", brands: ["Hydrocortisone Roussel"], category: "corticosteroid", forms: ["Comprimé", "Crème", "Injectable"], strengths: ["10mg", "1%", "100mg"], requiresPrescription: true },

  // ── Lipid-Lowering ──
  { id: "d066", dci: "Atorvastatine", brands: ["Tahor", "Lipitor"], category: "lipid-lowering", forms: ["Comprimé"], strengths: ["10mg", "20mg", "40mg", "80mg"], requiresPrescription: true },
  { id: "d067", dci: "Rosuvastatine", brands: ["Crestor"], category: "lipid-lowering", forms: ["Comprimé"], strengths: ["5mg", "10mg", "20mg", "40mg"], requiresPrescription: true },
  { id: "d068", dci: "Simvastatine", brands: ["Zocor", "Lodales"], category: "lipid-lowering", forms: ["Comprimé"], strengths: ["10mg", "20mg", "40mg"], requiresPrescription: true },
  { id: "d069", dci: "Fénofibrate", brands: ["Lipanthyl", "Sécalip"], category: "lipid-lowering", forms: ["Gélule", "Comprimé"], strengths: ["145mg", "160mg", "200mg", "300mg"], requiresPrescription: true },
  { id: "d070", dci: "Ézétimibe", brands: ["Ezetrol"], category: "lipid-lowering", forms: ["Comprimé"], strengths: ["10mg"], requiresPrescription: true },

  // ── Cardiac ──
  { id: "d071", dci: "Clopidogrel", brands: ["Plavix"], category: "antiplatelet", forms: ["Comprimé"], strengths: ["75mg", "300mg"], requiresPrescription: true },
  { id: "d072", dci: "Acénocoumarol", brands: ["Sintrom"], category: "anticoagulant", forms: ["Comprimé"], strengths: ["4mg"], requiresPrescription: true },
  { id: "d073", dci: "Warfarine", brands: ["Coumadine"], category: "anticoagulant", forms: ["Comprimé"], strengths: ["2mg", "5mg"], requiresPrescription: true },
  { id: "d074", dci: "Rivaroxaban", brands: ["Xarelto"], category: "anticoagulant", forms: ["Comprimé"], strengths: ["10mg", "15mg", "20mg"], requiresPrescription: true },
  { id: "d075", dci: "Énoxaparine", brands: ["Lovenox"], category: "anticoagulant", forms: ["Injectable SC"], strengths: ["2000 UI", "4000 UI", "6000 UI", "8000 UI"], requiresPrescription: true },
  { id: "d076", dci: "Digoxine", brands: ["Digoxine Nativelle"], category: "cardiac", forms: ["Comprimé", "Gouttes"], strengths: ["0.25mg"], requiresPrescription: true },
  { id: "d077", dci: "Amiodarone", brands: ["Cordarone"], category: "cardiac", forms: ["Comprimé", "Injectable"], strengths: ["200mg"], requiresPrescription: true },
  { id: "d078", dci: "Furosémide", brands: ["Lasilix"], category: "diuretic", forms: ["Comprimé", "Injectable"], strengths: ["20mg", "40mg", "500mg"], requiresPrescription: true },
  { id: "d079", dci: "Hydrochlorothiazide", brands: ["Esidrex"], category: "diuretic", forms: ["Comprimé"], strengths: ["12.5mg", "25mg"], requiresPrescription: true },
  { id: "d080", dci: "Spironolactone", brands: ["Aldactone"], category: "diuretic", forms: ["Comprimé"], strengths: ["25mg", "50mg", "75mg"], requiresPrescription: true },
  { id: "d081", dci: "Indapamide", brands: ["Fludex"], category: "diuretic", forms: ["Comprimé LP"], strengths: ["1.5mg LP"], requiresPrescription: true },
  { id: "d082", dci: "Trinitrine", brands: ["Natispray", "Lénitral"], category: "cardiac", forms: ["Spray sublingual", "Patch"], strengths: ["0.15mg/dose", "0.30mg/dose", "5mg/24h", "10mg/24h"], requiresPrescription: true },

  // ── Respiratory / Bronchodilators ──
  { id: "d083", dci: "Salbutamol", brands: ["Ventoline"], category: "bronchodilator", forms: ["Aérosol doseur", "Nébulisation", "Sirop"], strengths: ["100µg/dose", "5mg/mL"], requiresPrescription: true },
  { id: "d084", dci: "Budésonide", brands: ["Pulmicort"], category: "respiratory", forms: ["Suspension pour nébulisation", "Aérosol"], strengths: ["0.5mg/2mL", "1mg/2mL", "200µg/dose"], requiresPrescription: true },
  { id: "d085", dci: "Béclométasone", brands: ["Bécotide", "Qvar"], category: "respiratory", forms: ["Aérosol doseur"], strengths: ["50µg/dose", "100µg/dose", "250µg/dose"], requiresPrescription: true },
  { id: "d086", dci: "Fluticasone + Salmétérol", brands: ["Sérétide"], category: "respiratory", forms: ["Diskus", "Aérosol"], strengths: ["100/50µg", "250/50µg", "500/50µg"], requiresPrescription: true },
  { id: "d087", dci: "Montélukast", brands: ["Singulair"], category: "respiratory", forms: ["Comprimé", "Comprimé à croquer", "Sachet"], strengths: ["4mg", "5mg", "10mg"], requiresPrescription: true },
  { id: "d088", dci: "Acétylcystéine", brands: ["Mucomyst", "Fluimucil"], category: "respiratory", forms: ["Sachet", "Comprimé effervescent"], strengths: ["200mg", "600mg"], requiresPrescription: false },
  { id: "d089", dci: "Carbocistéine", brands: ["Rhinathiol", "Bronchokod"], category: "respiratory", forms: ["Sirop", "Sachet"], strengths: ["2%", "5%", "750mg"], requiresPrescription: false },
  { id: "d090", dci: "Terbutaline", brands: ["Bricanyl"], category: "bronchodilator", forms: ["Comprimé", "Aérosol", "Injectable"], strengths: ["5mg", "500µg/dose"], requiresPrescription: true },
  { id: "d091", dci: "Ipratropium", brands: ["Atrovent"], category: "bronchodilator", forms: ["Aérosol", "Nébulisation"], strengths: ["20µg/dose", "0.25mg/mL"], requiresPrescription: true },

  // ── Anxiolytics / Sedatives ──
  { id: "d092", dci: "Alprazolam", brands: ["Xanax"], category: "anxiolytic", forms: ["Comprimé"], strengths: ["0.25mg", "0.5mg", "1mg"], requiresPrescription: true },
  { id: "d093", dci: "Bromazépam", brands: ["Lexomil"], category: "anxiolytic", forms: ["Comprimé"], strengths: ["6mg"], requiresPrescription: true },
  { id: "d094", dci: "Diazépam", brands: ["Valium"], category: "anxiolytic", forms: ["Comprimé", "Gouttes", "Injectable"], strengths: ["2mg", "5mg", "10mg"], requiresPrescription: true },
  { id: "d095", dci: "Hydroxyzine", brands: ["Atarax"], category: "anxiolytic", forms: ["Comprimé", "Sirop"], strengths: ["25mg", "100mg"], requiresPrescription: true },
  { id: "d096", dci: "Zolpidem", brands: ["Stilnox"], category: "anxiolytic", forms: ["Comprimé"], strengths: ["10mg"], requiresPrescription: true },
  { id: "d097", dci: "Zopiclone", brands: ["Imovane"], category: "anxiolytic", forms: ["Comprimé"], strengths: ["3.75mg", "7.5mg"], requiresPrescription: true },

  // ── Antidepressants ──
  { id: "d098", dci: "Escitalopram", brands: ["Seroplex"], category: "antidepressant", forms: ["Comprimé", "Gouttes"], strengths: ["5mg", "10mg", "15mg", "20mg"], requiresPrescription: true },
  { id: "d099", dci: "Sertraline", brands: ["Zoloft"], category: "antidepressant", forms: ["Gélule", "Comprimé"], strengths: ["25mg", "50mg", "100mg"], requiresPrescription: true },
  { id: "d100", dci: "Paroxétine", brands: ["Deroxat"], category: "antidepressant", forms: ["Comprimé"], strengths: ["20mg", "30mg"], requiresPrescription: true },
  { id: "d101", dci: "Fluoxétine", brands: ["Prozac"], category: "antidepressant", forms: ["Gélule", "Solution buvable"], strengths: ["20mg"], requiresPrescription: true },
  { id: "d102", dci: "Venlafaxine", brands: ["Effexor"], category: "antidepressant", forms: ["Gélule LP"], strengths: ["37.5mg", "75mg", "150mg"], requiresPrescription: true },
  { id: "d103", dci: "Amitriptyline", brands: ["Laroxyl"], category: "antidepressant", forms: ["Comprimé", "Gouttes"], strengths: ["25mg", "50mg", "75mg"], requiresPrescription: true },

  // ── Antiepileptics ──
  { id: "d104", dci: "Valproate de Sodium", brands: ["Dépakine"], category: "antiepileptic", forms: ["Comprimé", "Sirop", "Injectable"], strengths: ["200mg", "500mg", "500mg LP"], requiresPrescription: true },
  { id: "d105", dci: "Carbamazépine", brands: ["Tégrétol"], category: "antiepileptic", forms: ["Comprimé", "Comprimé LP"], strengths: ["200mg", "400mg LP"], requiresPrescription: true },
  { id: "d106", dci: "Lévétiracétam", brands: ["Keppra"], category: "antiepileptic", forms: ["Comprimé", "Solution buvable", "Injectable"], strengths: ["250mg", "500mg", "1000mg"], requiresPrescription: true },
  { id: "d107", dci: "Lamotrigine", brands: ["Lamictal"], category: "antiepileptic", forms: ["Comprimé", "Comprimé dispersible"], strengths: ["25mg", "50mg", "100mg", "200mg"], requiresPrescription: true },
  { id: "d108", dci: "Prégabaline", brands: ["Lyrica"], category: "antiepileptic", forms: ["Gélule"], strengths: ["25mg", "50mg", "75mg", "150mg", "300mg"], requiresPrescription: true },
  { id: "d109", dci: "Gabapentine", brands: ["Neurontin"], category: "antiepileptic", forms: ["Gélule", "Comprimé"], strengths: ["100mg", "300mg", "400mg", "600mg", "800mg"], requiresPrescription: true },

  // ── Thyroid ──
  { id: "d110", dci: "Lévothyroxine", brands: ["Lévothyrox", "L-Thyroxine"], category: "thyroid", forms: ["Comprimé", "Solution buvable"], strengths: ["25µg", "50µg", "75µg", "100µg", "125µg", "150µg", "175µg", "200µg"], requiresPrescription: true },
  { id: "d111", dci: "Carbimazole", brands: ["Néo-Mercazole"], category: "thyroid", forms: ["Comprimé"], strengths: ["5mg", "20mg"], requiresPrescription: true },
  { id: "d112", dci: "Propylthiouracile", brands: ["Propylex"], category: "thyroid", forms: ["Comprimé"], strengths: ["50mg"], requiresPrescription: true },

  // ── Antifungals ──
  { id: "d113", dci: "Fluconazole", brands: ["Triflucan"], category: "antifungal", forms: ["Gélule", "Sirop", "Injectable"], strengths: ["50mg", "100mg", "150mg", "200mg"], requiresPrescription: true },
  { id: "d114", dci: "Kétoconazole", brands: ["Nizoral"], category: "antifungal", forms: ["Comprimé", "Shampooing", "Crème"], strengths: ["200mg", "2%"], requiresPrescription: true },
  { id: "d115", dci: "Terbinafine", brands: ["Lamisil"], category: "antifungal", forms: ["Comprimé", "Crème"], strengths: ["250mg", "1%"], requiresPrescription: true },
  { id: "d116", dci: "Nystatine", brands: ["Mycostatine"], category: "antifungal", forms: ["Suspension buvable", "Comprimé vaginal"], strengths: ["100 000 UI/mL"], requiresPrescription: true },
  { id: "d117", dci: "Miconazole", brands: ["Daktarin"], category: "antifungal", forms: ["Gel buccal", "Crème", "Poudre"], strengths: ["2%"], requiresPrescription: false },

  // ── Dermatology ──
  { id: "d118", dci: "Acide Fusidique", brands: ["Fucidine"], category: "dermatology", forms: ["Crème", "Pommade", "Comprimé"], strengths: ["2%", "250mg"], requiresPrescription: true },
  { id: "d119", dci: "Mupirocine", brands: ["Mupiderm"], category: "dermatology", forms: ["Pommade"], strengths: ["2%"], requiresPrescription: true },
  { id: "d120", dci: "Adapalène", brands: ["Différine"], category: "dermatology", forms: ["Gel", "Crème"], strengths: ["0.1%", "0.3%"], requiresPrescription: true },
  { id: "d121", dci: "Peroxyde de Benzoyle", brands: ["Cutacnyl", "Eclaran"], category: "dermatology", forms: ["Gel"], strengths: ["2.5%", "5%", "10%"], requiresPrescription: false },
  { id: "d122", dci: "Isotrétinoïne", brands: ["Roaccutane", "Curacné"], category: "dermatology", forms: ["Gélule"], strengths: ["5mg", "10mg", "20mg", "40mg"], requiresPrescription: true },
  { id: "d123", dci: "Calcipotriol", brands: ["Daivonex"], category: "dermatology", forms: ["Crème", "Pommade"], strengths: ["50µg/g"], requiresPrescription: true },
  { id: "d124", dci: "Tacrolimus", brands: ["Protopic"], category: "dermatology", forms: ["Pommade"], strengths: ["0.03%", "0.1%"], requiresPrescription: true },

  // ── Antivirals ──
  { id: "d125", dci: "Aciclovir", brands: ["Zovirax"], category: "antiviral", forms: ["Comprimé", "Crème", "Injectable"], strengths: ["200mg", "400mg", "800mg", "5%"], requiresPrescription: true },
  { id: "d126", dci: "Valaciclovir", brands: ["Zelitrex"], category: "antiviral", forms: ["Comprimé"], strengths: ["500mg", "1g"], requiresPrescription: true },
  { id: "d127", dci: "Oseltamivir", brands: ["Tamiflu"], category: "antiviral", forms: ["Gélule", "Sirop"], strengths: ["30mg", "45mg", "75mg"], requiresPrescription: true },

  // ── Hormones ──
  { id: "d128", dci: "Lévonorgestrel + Éthinylestradiol", brands: ["Minidril", "Trinordiol"], category: "hormone", forms: ["Comprimé"], strengths: ["150µg/30µg"], requiresPrescription: true },
  { id: "d129", dci: "Drospirénone + Éthinylestradiol", brands: ["Jasmine", "Yaz"], category: "hormone", forms: ["Comprimé"], strengths: ["3mg/0.02mg", "3mg/0.03mg"], requiresPrescription: true },
  { id: "d130", dci: "Progestérone", brands: ["Utrogestan"], category: "hormone", forms: ["Capsule molle"], strengths: ["100mg", "200mg"], requiresPrescription: true },
  { id: "d131", dci: "Lévonorgestrel", brands: ["Norlevo", "Microval"], category: "hormone", forms: ["Comprimé"], strengths: ["1.5mg", "0.03mg"], requiresPrescription: true },
  { id: "d132", dci: "Testostérone", brands: ["Androtardyl", "Nebido"], category: "hormone", forms: ["Injectable IM"], strengths: ["250mg/mL", "1000mg/4mL"], requiresPrescription: true },

  // ── Ophthalmic ──
  { id: "d133", dci: "Tobramycine", brands: ["Tobrex"], category: "ophthalmic", forms: ["Collyre", "Pommade ophtalmique"], strengths: ["0.3%"], requiresPrescription: true },
  { id: "d134", dci: "Dexaméthasone Ophtalmique", brands: ["Maxidex"], category: "ophthalmic", forms: ["Collyre"], strengths: ["0.1%"], requiresPrescription: true },
  { id: "d135", dci: "Timolol Ophtalmique", brands: ["Timoptol"], category: "ophthalmic", forms: ["Collyre"], strengths: ["0.25%", "0.5%"], requiresPrescription: true },
  { id: "d136", dci: "Latanoprost", brands: ["Xalatan"], category: "ophthalmic", forms: ["Collyre"], strengths: ["50µg/mL"], requiresPrescription: true },
  { id: "d137", dci: "Cromoglicate de Sodium", brands: ["Opticron", "Cromabak"], category: "ophthalmic", forms: ["Collyre"], strengths: ["2%"], requiresPrescription: false },
  { id: "d138", dci: "Larmes Artificielles", brands: ["Refresh", "Systane", "Hyabak"], category: "ophthalmic", forms: ["Collyre"], strengths: ["0.15%", "0.18%"], requiresPrescription: false },

  // ── Muscle Relaxants ──
  { id: "d139", dci: "Thiocolchicoside", brands: ["Coltramyl", "Miorel"], category: "muscle-relaxant", forms: ["Comprimé", "Injectable"], strengths: ["4mg", "8mg"], requiresPrescription: true },
  { id: "d140", dci: "Méthocarbamol", brands: ["Lumirelax"], category: "muscle-relaxant", forms: ["Comprimé"], strengths: ["750mg"], requiresPrescription: true },
  { id: "d141", dci: "Tétrazépam", brands: ["Myolastan"], category: "muscle-relaxant", forms: ["Comprimé"], strengths: ["50mg"], requiresPrescription: true },
  { id: "d142", dci: "Baclofène", brands: ["Liorésal"], category: "muscle-relaxant", forms: ["Comprimé"], strengths: ["10mg", "25mg"], requiresPrescription: true },

  // ── Supplements / Vitamins ──
  { id: "d143", dci: "Fer (Sulfate Ferreux)", brands: ["Tardyferon", "Fumafer", "Fero-Grad"], category: "supplement", forms: ["Comprimé", "Sirop"], strengths: ["80mg", "256mg", "105mg"], requiresPrescription: false },
  { id: "d144", dci: "Acide Folique", brands: ["Spéciafoldine"], category: "supplement", forms: ["Comprimé"], strengths: ["0.4mg", "5mg"], requiresPrescription: false },
  { id: "d145", dci: "Vitamine D3 (Cholécalciférol)", brands: ["Uvédose", "ZymaD", "Adrigyl"], category: "supplement", forms: ["Ampoule buvable", "Gouttes"], strengths: ["100 000 UI", "200 000 UI", "10 000 UI/mL"], requiresPrescription: false },
  { id: "d146", dci: "Calcium + Vitamine D", brands: ["Calcidose", "Orocal D3", "Caltrate D3"], category: "supplement", forms: ["Sachet", "Comprimé"], strengths: ["500mg/400UI", "1000mg/880UI"], requiresPrescription: false },
  { id: "d147", dci: "Vitamine B12 (Cyanocobalamine)", brands: ["Vitamine B12 Gerda"], category: "supplement", forms: ["Comprimé", "Injectable"], strengths: ["250µg", "1000µg"], requiresPrescription: false },
  { id: "d148", dci: "Magnésium + Vitamine B6", brands: ["Magné B6", "Mag 2"], category: "supplement", forms: ["Comprimé", "Ampoule buvable"], strengths: ["48mg/5mg", "100mg"], requiresPrescription: false },
  { id: "d149", dci: "Zinc", brands: ["Zinc Oligosol", "Rubozinc"], category: "supplement", forms: ["Gélule", "Ampoule"], strengths: ["15mg"], requiresPrescription: false },
  { id: "d150", dci: "Vitamine C (Acide Ascorbique)", brands: ["Laroscorbine", "Upsa C"], category: "supplement", forms: ["Comprimé effervescent", "Comprimé"], strengths: ["500mg", "1000mg"], requiresPrescription: false },

  // ── Urological ──
  { id: "d151", dci: "Tamsulosine", brands: ["Omix", "Josir"], category: "urological", forms: ["Gélule LP"], strengths: ["0.4mg"], requiresPrescription: true },
  { id: "d152", dci: "Alfuzosine", brands: ["Xatral"], category: "urological", forms: ["Comprimé LP"], strengths: ["10mg LP"], requiresPrescription: true },
  { id: "d153", dci: "Finastéride", brands: ["Chibro-Proscar", "Propécia"], category: "urological", forms: ["Comprimé"], strengths: ["1mg", "5mg"], requiresPrescription: true },
  { id: "d154", dci: "Sildénafil", brands: ["Viagra", "Vizarsin"], category: "urological", forms: ["Comprimé"], strengths: ["25mg", "50mg", "100mg"], requiresPrescription: true },
  { id: "d155", dci: "Tadalafil", brands: ["Cialis"], category: "urological", forms: ["Comprimé"], strengths: ["5mg", "10mg", "20mg"], requiresPrescription: true },

  // ── Antiparasitics ──
  { id: "d156", dci: "Albendazole", brands: ["Zentel"], category: "antiparasitic", forms: ["Comprimé", "Suspension"], strengths: ["400mg", "4%"], requiresPrescription: true },
  { id: "d157", dci: "Mébendazole", brands: ["Vermox"], category: "antiparasitic", forms: ["Comprimé", "Suspension"], strengths: ["100mg", "500mg"], requiresPrescription: true },
  { id: "d158", dci: "Ivermectine", brands: ["Stromectol", "Mectizan"], category: "antiparasitic", forms: ["Comprimé"], strengths: ["3mg"], requiresPrescription: true },
  { id: "d159", dci: "Quinine", brands: ["Quinimax", "Surquina"], category: "antiparasitic", forms: ["Comprimé", "Injectable"], strengths: ["300mg", "500mg"], requiresPrescription: true },
  { id: "d160", dci: "Perméthrine", brands: ["Sprégal", "Lyclear"], category: "antiparasitic", forms: ["Lotion", "Crème"], strengths: ["1%", "5%"], requiresPrescription: false },

  // ── Antipsychotics ──
  { id: "d161", dci: "Halopéridol", brands: ["Haldol"], category: "antipsychotic", forms: ["Comprimé", "Gouttes", "Injectable"], strengths: ["1mg", "5mg", "2mg/mL"], requiresPrescription: true },
  { id: "d162", dci: "Rispéridone", brands: ["Risperdal"], category: "antipsychotic", forms: ["Comprimé", "Solution buvable", "Injectable LP"], strengths: ["1mg", "2mg", "3mg", "4mg"], requiresPrescription: true },
  { id: "d163", dci: "Olanzapine", brands: ["Zyprexa"], category: "antipsychotic", forms: ["Comprimé", "Comprimé orodispersible"], strengths: ["2.5mg", "5mg", "10mg", "15mg", "20mg"], requiresPrescription: true },
  { id: "d164", dci: "Quétiapine", brands: ["Seroquel", "Xeroquel"], category: "antipsychotic", forms: ["Comprimé", "Comprimé LP"], strengths: ["25mg", "100mg", "200mg", "300mg"], requiresPrescription: true },
  { id: "d165", dci: "Aripiprazole", brands: ["Abilify"], category: "antipsychotic", forms: ["Comprimé", "Injectable"], strengths: ["5mg", "10mg", "15mg", "30mg"], requiresPrescription: true },

  // ── Antiemetics ──
  { id: "d166", dci: "Ondansétron", brands: ["Zophren"], category: "antiemetic", forms: ["Comprimé", "Comprimé orodispersible", "Injectable"], strengths: ["4mg", "8mg"], requiresPrescription: true },
  { id: "d167", dci: "Métopimazine", brands: ["Vogalène"], category: "antiemetic", forms: ["Gélule", "Suppositoire", "Injectable"], strengths: ["15mg"], requiresPrescription: true },

  // ── Additional Common Drugs ──
  { id: "d168", dci: "Allopurinol", brands: ["Zyloric"], category: "other", forms: ["Comprimé"], strengths: ["100mg", "200mg", "300mg"], requiresPrescription: true },
  { id: "d169", dci: "Colchicine", brands: ["Colchimax", "Colchicine Opocalcium"], category: "other", forms: ["Comprimé"], strengths: ["0.5mg", "1mg"], requiresPrescription: true },
  { id: "d170", dci: "Méthotrexate", brands: ["Novatrex", "Metoject"], category: "other", forms: ["Comprimé", "Injectable SC"], strengths: ["2.5mg", "7.5mg", "10mg", "15mg", "20mg", "25mg"], requiresPrescription: true },
  { id: "d171", dci: "Hydroxychloroquine", brands: ["Plaquenil"], category: "other", forms: ["Comprimé"], strengths: ["200mg"], requiresPrescription: true },
  { id: "d172", dci: "Propranolol", brands: ["Avlocardyl"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["40mg", "80mg", "160mg LP"], requiresPrescription: true },
  { id: "d173", dci: "Diosmine", brands: ["Daflon", "Diosmine"], category: "other", forms: ["Comprimé"], strengths: ["500mg", "1000mg"], requiresPrescription: false },
  { id: "d174", dci: "Troxérutine", brands: ["Veinamitol", "Rhéoflux"], category: "other", forms: ["Gélule", "Sachet"], strengths: ["350mg", "3.5g"], requiresPrescription: false },
  { id: "d175", dci: "Chlorhexidine", brands: ["Eludril", "Paroex"], category: "other", forms: ["Bain de bouche", "Gel"], strengths: ["0.12%", "0.2%"], requiresPrescription: false },
  { id: "d176", dci: "Kétotifène", brands: ["Zaditen"], category: "antihistamine", forms: ["Comprimé", "Sirop", "Collyre"], strengths: ["1mg", "0.25mg/mL"], requiresPrescription: true },
  { id: "d177", dci: "Oxybuprocaïne", brands: ["Cébésine"], category: "ophthalmic", forms: ["Collyre"], strengths: ["0.4%"], requiresPrescription: true },
  { id: "d178", dci: "Clonazépam", brands: ["Rivotril"], category: "antiepileptic", forms: ["Comprimé", "Gouttes", "Injectable"], strengths: ["0.5mg", "2mg", "2.5mg/mL"], requiresPrescription: true },
  { id: "d179", dci: "Métformine + Sitagliptine", brands: ["Janumet"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["500mg/50mg", "1000mg/50mg"], requiresPrescription: true },
  { id: "d180", dci: "Amlodipine + Valsartan", brands: ["Exforge"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["5mg/80mg", "5mg/160mg", "10mg/160mg"], requiresPrescription: true },
  { id: "d181", dci: "Périndopril + Indapamide", brands: ["Bipreterax", "Preterax"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["2.5mg/0.625mg", "5mg/1.25mg", "10mg/2.5mg"], requiresPrescription: true },
  { id: "d182", dci: "Losartan + Hydrochlorothiazide", brands: ["Hyzaar", "Fortzaar"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["50mg/12.5mg", "100mg/25mg"], requiresPrescription: true },
  { id: "d183", dci: "Bisoprolol + Hydrochlorothiazide", brands: ["Lodoz"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["2.5mg/6.25mg", "5mg/6.25mg", "10mg/6.25mg"], requiresPrescription: true },
  { id: "d184", dci: "Atorvastatine + Ézétimibe", brands: ["Liptruzet"], category: "lipid-lowering", forms: ["Comprimé"], strengths: ["10mg/10mg", "20mg/10mg", "40mg/10mg"], requiresPrescription: true },
  { id: "d185", dci: "Dorzolamide + Timolol", brands: ["Cosopt"], category: "ophthalmic", forms: ["Collyre"], strengths: ["2%/0.5%"], requiresPrescription: true },
  { id: "d186", dci: "Saccharomyces Boulardii", brands: ["Ultra-Levure"], category: "gastrointestinal", forms: ["Gélule", "Sachet"], strengths: ["50mg", "100mg", "200mg"], requiresPrescription: false },
  { id: "d187", dci: "Trimébutine", brands: ["Débridat"], category: "gastrointestinal", forms: ["Comprimé", "Sirop", "Suppositoire"], strengths: ["100mg", "200mg", "4.8mg/mL"], requiresPrescription: false },
  { id: "d188", dci: "Mébévérine", brands: ["Duspatalin"], category: "gastrointestinal", forms: ["Comprimé", "Gélule LP"], strengths: ["135mg", "200mg LP"], requiresPrescription: true },
  { id: "d189", dci: "Érythropoïétine", brands: ["Eprex", "NeoRecormon"], category: "other", forms: ["Injectable SC/IV"], strengths: ["1000 UI", "2000 UI", "4000 UI", "10 000 UI"], requiresPrescription: true },
  { id: "d190", dci: "Clotrimazole", brands: ["Mycohydralin", "Canesten"], category: "antifungal", forms: ["Crème", "Comprimé vaginal"], strengths: ["1%", "500mg"], requiresPrescription: false },
  { id: "d191", dci: "Métformone + Vildagliptine", brands: ["Eucreas"], category: "antidiabetic", forms: ["Comprimé"], strengths: ["50mg/850mg", "50mg/1000mg"], requiresPrescription: true },
  { id: "d192", dci: "Loperamide + Siméticone", brands: ["Imodiumduo"], category: "gastrointestinal", forms: ["Comprimé"], strengths: ["2mg/125mg"], requiresPrescription: false },
  { id: "d193", dci: "Aténolol + Chlorthalidone", brands: ["Ténoretic"], category: "antihypertensive", forms: ["Comprimé"], strengths: ["50mg/12.5mg", "100mg/25mg"], requiresPrescription: true },
  { id: "d194", dci: "Lévodopa + Carbidopa", brands: ["Sinemet"], category: "other", forms: ["Comprimé", "Comprimé LP"], strengths: ["100mg/25mg", "250mg/25mg"], requiresPrescription: true },
  { id: "d195", dci: "Piracétam", brands: ["Nootropyl"], category: "other", forms: ["Comprimé", "Solution buvable"], strengths: ["800mg", "1200mg"], requiresPrescription: true },
  { id: "d196", dci: "Bétahistine", brands: ["Serc", "Betaserc"], category: "other", forms: ["Comprimé"], strengths: ["8mg", "16mg", "24mg"], requiresPrescription: true },
  { id: "d197", dci: "Acide Tranexamique", brands: ["Exacyl"], category: "other", forms: ["Comprimé", "Injectable", "Solution buvable"], strengths: ["500mg", "1g"], requiresPrescription: true },
  { id: "d198", dci: "Ciproterone + Éthinylestradiol", brands: ["Diane 35"], category: "hormone", forms: ["Comprimé"], strengths: ["2mg/0.035mg"], requiresPrescription: true },
  { id: "d199", dci: "Misoprostol", brands: ["Cytotec"], category: "gastrointestinal", forms: ["Comprimé"], strengths: ["200µg"], requiresPrescription: true },
  { id: "d200", dci: "Oxytocine", brands: ["Syntocinon"], category: "hormone", forms: ["Injectable IV/IM"], strengths: ["5 UI", "10 UI"], requiresPrescription: true },
];

// ---- Pre-built Search Index (A73-F5) ----

/**
 * Normalize text for search: lowercase, remove diacritics.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * A73-F5: Pre-built index for O(1) prefix lookups instead of O(N) linear scan.
 * Maps normalized DCI names and brand names to their drug entries.
 * Built once at module load time.
 */
interface DrugIndexEntry {
  drug: DCIDrug;
  /** "dci" or "brand" — determines base score */
  matchType: "dci" | "brand";
  /** The normalized search key */
  key: string;
}

const _drugIndex: Map<string, DrugIndexEntry[]> = new Map();

function ensureDrugIndex(): Map<string, DrugIndexEntry[]> {
  if (_drugIndex.size > 0) return _drugIndex;

  for (const drug of DCI_DRUG_DATABASE) {
    // Index by normalized DCI name
    const dciNorm = normalize(drug.dci);
    const dciEntry: DrugIndexEntry = { drug, matchType: "dci", key: dciNorm };
    // Add entries for every prefix length >= 2
    for (let len = 2; len <= dciNorm.length; len++) {
      const prefix = dciNorm.slice(0, len);
      const list = _drugIndex.get(prefix) ?? [];
      list.push(dciEntry);
      _drugIndex.set(prefix, list);
    }

    // Index by normalized brand names
    for (const brand of drug.brands) {
      const brandNorm = normalize(brand);
      const brandEntry: DrugIndexEntry = { drug, matchType: "brand", key: brandNorm };
      for (let len = 2; len <= brandNorm.length; len++) {
        const prefix = brandNorm.slice(0, len);
        const list = _drugIndex.get(prefix) ?? [];
        list.push(brandEntry);
        _drugIndex.set(prefix, list);
      }
    }
  }

  return _drugIndex;
}

// ---- Search Utilities ----

/**
 * Search the drug database by DCI name or brand name.
 * Returns matching drugs sorted by relevance.
 *
 * A73-F5: Uses pre-built prefix index for fast lookups instead of
 * scanning the entire 43k-line database on every request.
 */
export function searchDrugs(query: string, limit = 20): DCIDrug[] {
  if (!query || query.length < 2) return [];

  const q = normalize(query);
  const index = ensureDrugIndex();

  type ScoredDrug = { drug: DCIDrug; score: number };
  const seen = new Set<string>();
  const results: ScoredDrug[] = [];

  // Fast path: look up candidates from the prefix index using the query
  // as a prefix key. This avoids scanning all ~200 drugs on every request.
  const candidates = index.get(q) ?? [];

  // A80-3 fix: Fallback to substring search when prefix index has no results.
  // Previously `dciNorm.includes(q)` matched "oxicam" → "Piroxicam" (score 60),
  // but prefix-only indexing drops mid-string matches. Add a lightweight fallback
  // that scans DCI names for substring matches to preserve this behavior.
  const fallbackResults: ScoredDrug[] = [];
  if (candidates.length === 0) {
    for (const drug of DCI_DRUG_DATABASE) {
      const dciNorm = normalize(drug.dci);
      if (dciNorm.includes(q) || drug.brands.some((b) => normalize(b).includes(q))) {
        fallbackResults.push({ drug, score: 40 }); // Substring match gets lower priority
      }
    }
  }

  for (const entry of candidates) {
    if (seen.has(entry.drug.id)) continue;
    seen.add(entry.drug.id);

    let score = 0;
    if (entry.matchType === "dci") {
      if (entry.key === q) score = 100;
      else if (entry.key.startsWith(q)) score = 80;
      else score = 60; // contains match (indexed via substring prefix)
    } else {
      if (entry.key === q) score = 90;
      else if (entry.key.startsWith(q)) score = 70;
      else score = 50;
    }

    if (score > 0) {
      results.push({ drug: entry.drug, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  // A80-3 fix: Merge fallback results and sort together
  const merged = [...results, ...fallbackResults];
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit).map((r) => r.drug);
}

/**
 * Get all unique drug categories present in the database.
 */
export function getDrugCategories(): DCIDrugCategory[] {
  const categories = new Set<DCIDrugCategory>();
  for (const drug of DCI_DRUG_DATABASE) {
    categories.add(drug.category);
  }
  return Array.from(categories).sort();
}

/**
 * Filter drugs by category.
 */
export function getDrugsByCategory(category: DCIDrugCategory): DCIDrug[] {
  return DCI_DRUG_DATABASE.filter((d) => d.category === category);
}
