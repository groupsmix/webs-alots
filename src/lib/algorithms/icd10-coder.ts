/**
 * ICD-10 Diagnosis Coder.
 *
 * Provides a local fuzzy-match algorithm for mapping natural language diagnosis
 * strings to ICD-10 codes commonly used in Moroccan outpatient clinics.
 *
 * This allows real-time coding suggestions without hitting an external AI provider.
 */

export interface ICD10Code {
  code: string;
  description_fr: string;
  description_ar: string;
  keywords_fr: string[];
}

export interface CodeSuggestion {
  code: string;
  description_fr: string;
  description_ar: string;
  confidence: number;
}

// ── Local ICD-10 Subset (Top Primary Care Codes) ───────────────────────────

const COMMON_CODES: ICD10Code[] = [
  // Respiratory
  {
    code: "J01.9",
    description_fr: "Sinusite aiguë, sans précision",
    description_ar: "التهاب الجيوب الأنفية الحاد",
    keywords_fr: ["sinusite", "nez bouché", "douleur faciale", "rhume", "rhinite"]
  },
  {
    code: "J03.9",
    description_fr: "Amygdalite aiguë, sans précision",
    description_ar: "التهاب اللوزتين الحاد",
    keywords_fr: ["angine", "amygdalite", "gorge", "douleur gorge", "déglutition"]
  },
  {
    code: "J20.9",
    description_fr: "Bronchite aiguë, sans précision",
    description_ar: "التهاب الشعب الهوائية الحاد",
    keywords_fr: ["bronchite", "toux", "crachat", "poumon"]
  },
  {
    code: "J45.9",
    description_fr: "Asthme, sans précision",
    description_ar: "الربو",
    keywords_fr: ["asthme", "respiration", "sifflement", "dyspnée"]
  },

  // Cardiovascular & Metabolic
  {
    code: "I10",
    description_fr: "Hypertension essentielle (primitive)",
    description_ar: "ارتفاع ضغط الدم",
    keywords_fr: ["hta", "hypertension", "tension", "artérielle", "hyper tension"]
  },
  {
    code: "E11.9",
    description_fr: "Diabète sucré de type 2 sans complications",
    description_ar: "مرض السكري من النوع 2",
    keywords_fr: ["diabète", "type 2", "dnid", "sucre", "glycémie"]
  },
  {
    code: "E78.5",
    description_fr: "Hyperlipidémie, sans précision",
    description_ar: "فرط شحميات الدم",
    keywords_fr: ["cholestérol", "hyperlipidémie", "dyslipidémie", "triglycérides", "hdl", "ldl"]
  },

  // Gastrointestinal
  {
    code: "K21.9",
    description_fr: "Reflux gastro-œsophagien sans œsophagite",
    description_ar: "الارتجاع المعدي المريئي",
    keywords_fr: ["rgo", "reflux", "brûlure", "estomac", "gastrique", "acidité"]
  },
  {
    code: "K29.7",
    description_fr: "Gastrite, sans précision",
    description_ar: "التهاب المعدة",
    keywords_fr: ["gastrite", "maux d'estomac", "douleur épigastrique"]
  },

  // Musculoskeletal
  {
    code: "M54.5",
    description_fr: "Lombalgie",
    description_ar: "ألم أسفل الظهر",
    keywords_fr: ["lombalgie", "dos", "douleur dos", "lumbago", "vertèbres"]
  },
  {
    code: "M15.9",
    description_fr: "Polyarthrose, sans précision",
    description_ar: "التهاب المفاصل المتعدد",
    keywords_fr: ["arthrose", "articulation", "douleur articulaire", "rhumatisme"]
  },

  // General / Symptoms
  {
    code: "R50.9",
    description_fr: "Fièvre, sans précision",
    description_ar: "حمى",
    keywords_fr: ["fièvre", "température", "chaud"]
  },
  {
    code: "R51",
    description_fr: "Céphalée",
    description_ar: "صداع",
    keywords_fr: ["céphalée", "tête", "migraine", "mal de tête"]
  }
];

// ── Search Algorithm ────────────────────────────────────────────────────────

/**
 * Normalizes text for searching: lowercase, strips accents, removes common stop words.
 */
function normalizeText(text: string): string {
  const noAccents = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  // Remove basic punctuation and extra spaces
  return noAccents
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Levenshtein distance for fuzzy matching typos.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Computes a similarity score (0.0 to 1.0) between a search query and a keyword.
 */
function scoreMatch(queryWord: string, keyword: string): number {
  // Exact match
  if (queryWord === keyword) return 1.0;
  
  // Prefix match (e.g. "hypert" -> "hypertension")
  if (keyword.startsWith(queryWord)) return 0.8;
  
  // Fuzzy match for typos if word is reasonably long
  if (queryWord.length > 3) {
    const dist = levenshteinDistance(queryWord, keyword);
    const maxLen = Math.max(queryWord.length, keyword.length);
    const similarity = 1 - dist / maxLen;
    if (similarity > 0.7) return similarity * 0.9;
  }
  
  return 0.0;
}

/**
 * Suggests ICD-10 codes based on natural language diagnosis text.
 * 
 * @param query The doctor's diagnosis text in French
 * @param limit Maximum number of suggestions to return
 */
export function suggestICD10Codes(query: string, limit: number = 3): CodeSuggestion[] {
  if (!query || query.trim().length === 0) return [];
  
  const normalizedQueryWords = normalizeText(query).split(" ");
  
  const scoredCodes = COMMON_CODES.map(code => {
    let maxScore = 0;
    
    // Check against title
    const normalizedTitle = normalizeText(code.description_fr);
    if (normalizedTitle.includes(normalizeText(query))) {
      maxScore = Math.max(maxScore, 0.95);
    }
    
    // Check against keywords
    let keywordScoreSum = 0;
    for (const qWord of normalizedQueryWords) {
      if (qWord.length < 3 && qWord !== "hta" && qWord !== "rgo") continue; // Skip small stop words unless medical acronym
      
      let bestWordScore = 0;
      for (const kw of code.keywords_fr) {
        const score = scoreMatch(qWord, normalizeText(kw));
        bestWordScore = Math.max(bestWordScore, score);
      }
      keywordScoreSum += bestWordScore;
    }
    
    // Normalize score based on query words that were actually checked
    const validWordsCount = normalizedQueryWords.filter(w => w.length >= 3 || w === "hta" || w === "rgo").length;
    if (validWordsCount > 0) {
      maxScore = Math.max(maxScore, keywordScoreSum / validWordsCount);
    }
    
    return {
      code,
      confidence: maxScore
    };
  });
  
  // Filter out low confidence matches and sort
  return scoredCodes
    .filter(s => s.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
    .map(s => ({
      code: s.code.code,
      description_fr: s.code.description_fr,
      description_ar: s.code.description_ar,
      confidence: Math.round(s.confidence * 100) / 100
    }));
}
