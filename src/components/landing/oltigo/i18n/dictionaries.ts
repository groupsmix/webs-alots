/**
 * OLTIGO i18n — lightweight dictionary-based localization (no heavy lib).
 * FR default · AR full RTL · EN. Telemetry/numerals stay LTR via the
 * `.telemetry` class and the <BilingualNumeral /> component.
 */

export const locales = ["fr", "ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
  en: "ltr",
};

export const localeLabel: Record<Locale, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export const localeName: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

type Feature = { num: string; title: string; tagline: string; bullets: string[] };
type Step = { num: string; title: string; body: string };
type Tier = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};
type Quote = { quote: string; name: string; role: string; city: string; plan: string };
type Faq = { q: string; a: string };

export type Dictionary = {
  nav: {
    status: string;
    login: string;
    openAccount: string;
    menu: string;
    sections: { features: string; how: string; pricing: string; faq: string };
  };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    captions: string[];
    trust: { uptime: string; uptimeLabel: string; cipher: string; law: string; latency: string };
  };
  whatsapp: { incoming: string; reply: string; status: string };
  telemetry: { rdv: string; p95: string; uptime: string; clinics: string; reminders: string };
  featuresHeading: { eyebrow: string; title: string; sub: string };
  features: Feature[];
  how: { eyebrow: string; title: string; sub: string; steps: Step[] };
  tenant: {
    eyebrow: string;
    title: string;
    sub: string;
    rlsTitle: string;
    rlsBody: string;
    subdomains: string[];
    isolated: string;
  };
  testimonials: { eyebrow: string; title: string; items: Quote[] };
  pricing: {
    eyebrow: string;
    title: string;
    sub: string;
    perMonth: string;
    currency: string;
    popular: string;
    tiers: Tier[];
    note: string;
  };
  faq: { eyebrow: string; title: string; items: Faq[] };
  cta: {
    eyebrow: string;
    title: string;
    sub: string;
    fields: { clinic: string; doctor: string; phone: string; email: string; city: string };
    placeholders: { clinic: string; doctor: string; phone: string; email: string; city: string };
    submit: string;
    submitting: string;
    success: string;
    error: string;
    whatsapp: string;
    consent: string;
  };
  footer: {
    tagline: string;
    columns: { title: string; links: string[] }[];
    rights: string;
    law: string;
  };
};

/* ========================================================================== */
/* FRANÇAIS (défaut)                                                          */
/* ========================================================================== */
const fr: Dictionary = {
  nav: {
    status: "Tous les systèmes opérationnels",
    login: "Connexion",
    openAccount: "Ouvrir un compte",
    menu: "Menu",
    sections: { features: "Fonctionnalités", how: "Comment ça marche", pricing: "Tarifs", faq: "FAQ" },
  },
  hero: {
    eyebrow: "Plateforme pour cabinets médicaux · Maroc",
    titleLead: "Le calme d’un cabinet",
    titleAccent: "qui tourne tout seul.",
    sub: "Prise de rendez-vous en ligne, dossiers patients chiffrés et rappels WhatsApp en darija. Conçu pour les médecins et gestionnaires de cabinet au Maroc.",
    ctaPrimary: "Ouvrir un compte",
    ctaSecondary: "Voir une démo",
    captions: ["01 — Rendez-vous", "02 — Dossier chiffré", "03 — Rappels Darija"],
    trust: {
      uptime: "99,95",
      uptimeLabel: "% de disponibilité",
      cipher: "AES-256-GCM",
      law: "Conforme Loi 09-08",
      latency: "< 200 ms",
    },
  },
  whatsapp: {
    incoming: "Rappel : RDV demain 14h30 au cabinet. Répondez OUI pour confirmer.",
    reply: "OUI",
    status: "Confirmé",
  },
  telemetry: {
    rdv: "RDV confirmés aujourd’hui",
    p95: "Latence P95",
    uptime: "Disponibilité · 30 j",
    clinics: "Cabinets actifs",
    reminders: "Rappels envoyés · 24 h",
  },
  featuresHeading: {
    eyebrow: "Le produit",
    title: "Trois certitudes, zéro friction.",
    sub: "Chaque couche fait une chose, parfaitement. Rien de superflu.",
  },
  features: [
    {
      num: "01",
      title: "Rendez-vous",
      tagline: "Une page de réservation publique et une vue semaine unifiée pour tout le cabinet.",
      bullets: [
        "Prise de rendez-vous en ligne, 24 h/24",
        "Confirmations et rappels WhatsApp automatiques",
        "Vue semaine unifiée, multi-praticiens",
        "Réduction mesurable des absences",
      ],
    },
    {
      num: "02",
      title: "Dossier patient",
      tagline: "Un coffre chiffré pour l’historique, les ordonnances et les documents.",
      bullets: [
        "Chiffrement AES-256-GCM au repos",
        "Historique complet et traçable",
        "Ordonnances et documents en un endroit",
        "Accès réservé à votre équipe",
      ],
    },
    {
      num: "03",
      title: "Rappels WhatsApp",
      tagline: "Des messages en darija, approuvés par Meta, envoyés au bon moment.",
      bullets: [
        "10 modèles en darija validés par Meta",
        "Envoi automatique avant chaque rendez-vous",
        "Confirmation par simple réponse « OUI »",
        "Moins d’absences, plus de temps de soin",
      ],
    },
  ],
  how: {
    eyebrow: "Mise en route",
    title: "Opérationnel en un après-midi.",
    sub: "Quatre étapes, sans informaticien.",
    steps: [
      { num: "01", title: "Créez votre compte", body: "Ouvrez votre cabinet sur OLTIGO en quelques minutes, sans carte bancaire." },
      { num: "02", title: "Configurez votre cabinet", body: "Praticiens, horaires, motifs de consultation et page de réservation." },
      { num: "03", title: "Importez vos patients", body: "Reprenez votre fichier existant ou ajoutez vos patients au fil de l’eau." },
      { num: "04", title: "Suivez votre activité", body: "Rendez-vous, rappels et indicateurs, en temps réel sur un seul écran." },
    ],
  },
  tenant: {
    eyebrow: "Architecture",
    title: "Chaque cabinet, dans son propre coffre.",
    sub: "Un sous-domaine dédié par cabinet, des données strictement cloisonnées. Le cabinet d’à côté n’existe pas pour le vôtre.",
    rlsTitle: "Row Level Security",
    rlsBody: "L’isolation est appliquée au niveau de la base de données : chaque requête est filtrée par cabinet. Aucune fuite possible entre locataires.",
    subdomains: ["cabinet-a.oltigo.com", "cabinet-b.oltigo.com", "cabinet-c.oltigo.com"],
    isolated: "Isolé",
  },
  testimonials: {
    eyebrow: "Confiance",
    title: "Des praticiens qui dorment mieux.",
    items: [
      {
        quote: "Les absences ont chuté dès le premier mois. Les patients confirment par WhatsApp sans même appeler le secrétariat.",
        name: "Dr. Yasmine Berrada",
        role: "Médecin généraliste",
        city: "Casablanca",
        plan: "Professional",
      },
      {
        quote: "Enfin un dossier patient que je n’ai pas peur d’ouvrir. C’est chiffré, c’est clair, c’est rapide.",
        name: "Dr. Karim El Fassi",
        role: "Cardiologue",
        city: "Rabat",
        plan: "Enterprise",
      },
      {
        quote: "Installé en une après-midi. Mon assistante a tout pris en main sans formation.",
        name: "Dr. Salima Ouazzani",
        role: "Pédiatre",
        city: "Marrakech",
        plan: "Starter",
      },
    ],
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Un tarif clair, en dirhams.",
    sub: "Sans engagement. Changez de formule quand vous voulez.",
    perMonth: "/ mois",
    currency: "MAD",
    popular: "Le plus choisi",
    tiers: [
      {
        id: "free",
        name: "Free",
        price: "0",
        cadence: "/ mois",
        blurb: "Pour tester, en solo.",
        features: ["1 praticien", "Page de réservation", "50 rendez-vous / mois", "Rappels par e-mail"],
        cta: "Commencer",
      },
      {
        id: "starter",
        name: "Starter",
        price: "199",
        cadence: "/ mois",
        blurb: "Pour le cabinet individuel.",
        features: ["Jusqu’à 2 praticiens", "Rendez-vous illimités", "Rappels WhatsApp", "Dossier patient chiffré"],
        cta: "Choisir Starter",
      },
      {
        id: "professional",
        name: "Professional",
        price: "599",
        cadence: "/ mois",
        blurb: "Pour le cabinet de groupe.",
        features: ["Jusqu’à 8 praticiens", "Modèles Darija avancés", "Statistiques d’activité", "Support prioritaire"],
        cta: "Choisir Professional",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "999",
        cadence: "/ mois",
        blurb: "Pour la polyclinique.",
        features: ["Praticiens illimités", "Multi-sites", "API & intégrations", "Accompagnement dédié"],
        cta: "Parler à l’équipe",
      },
    ],
    note: "Prix hors taxes. Hébergement et données au standard Loi 09-08.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Ce que les cabinets nous demandent.",
    items: [
      { q: "Mes données patients sont-elles en sécurité ?", a: "Oui. Chaque dossier est chiffré en AES-256-GCM au repos, et l’accès est strictement réservé à votre équipe. L’isolation entre cabinets est appliquée au niveau de la base de données." },
      { q: "OLTIGO est-il conforme à la Loi 09-08 ?", a: "Oui. Le traitement et la conservation des données personnelles suivent les exigences de la Loi 09-08 sur la protection des données au Maroc." },
      { q: "Les rappels WhatsApp sont-ils vraiment en darija ?", a: "Oui. Nous fournissons 10 modèles en darija approuvés par Meta, prêts à l’emploi, que vous pouvez personnaliser." },
      { q: "Puis-je importer mon fichier patients existant ?", a: "Oui. Vous pouvez importer votre fichier existant ou ajouter vos patients progressivement, sans interruption." },
      { q: "Combien de temps pour démarrer ?", a: "La plupart des cabinets sont opérationnels en un après-midi : compte, configuration, page de réservation et premiers rappels." },
      { q: "Et si j’ai plusieurs praticiens ou plusieurs sites ?", a: "Les formules Professional et Enterprise gèrent les cabinets de groupe et le multi-sites, avec un sous-domaine dédié par cabinet." },
      { q: "Puis-je changer ou résilier ma formule ?", a: "À tout moment, sans engagement. Vous passez d’une formule à l’autre directement depuis votre espace." },
      { q: "Mes patients doivent-ils installer une application ?", a: "Non. La réservation se fait depuis un navigateur, et les rappels arrivent sur WhatsApp, qu’ils utilisent déjà." },
    ],
  },
  cta: {
    eyebrow: "Démo",
    title: "Voyez OLTIGO sur votre cabinet.",
    sub: "Laissez-nous vos coordonnées : nous vous montrons l’essentiel en 20 minutes, sur vos cas réels.",
    fields: { clinic: "Cabinet", doctor: "Médecin", phone: "Téléphone", email: "E-mail", city: "Ville" },
    placeholders: {
      clinic: "Cabinet Atlas",
      doctor: "Dr. Prénom Nom",
      phone: "06 12 34 56 78",
      email: "vous@cabinet.ma",
      city: "Casablanca",
    },
    submit: "Demander la démo",
    submitting: "Envoi…",
    success: "Merci. Nous vous contactons sous 24 h.",
    error: "Un souci est survenu. Réessayez ou écrivez-nous sur WhatsApp.",
    whatsapp: "Écrire sur WhatsApp",
    consent: "En envoyant ce formulaire, vous acceptez d’être recontacté au sujet d’OLTIGO.",
  },
  footer: {
    tagline: "Le système d’exploitation discret des cabinets médicaux au Maroc.",
    columns: [
      { title: "Produit", links: ["Rendez-vous", "Dossier patient", "Rappels WhatsApp", "Tarifs"] },
      { title: "Ressources", links: ["Documentation", "Guide de démarrage", "Statut", "Journal des versions"] },
      { title: "Entreprise", links: ["À propos", "Contact", "Carrières", "Partenaires"] },
      { title: "Légal", links: ["Confidentialité", "Conditions", "Loi 09-08", "Sécurité"] },
    ],
    rights: "Tous droits réservés.",
    law: "Données hébergées et traitées conformément à la Loi 09-08.",
  },
};

/* ========================================================================== */
/* العربية (RTL)                                                              */
/* ========================================================================== */
const ar: Dictionary = {
  nav: {
    status: "كل الأنظمة تعمل بشكل سليم",
    login: "تسجيل الدخول",
    openAccount: "افتح حسابًا",
    menu: "القائمة",
    sections: { features: "الميزات", how: "كيف يعمل", pricing: "الأسعار", faq: "الأسئلة" },
  },
  hero: {
    eyebrow: "منصّة للعيادات الطبية · المغرب",
    titleLead: "هدوء عيادة",
    titleAccent: "تُدار من تلقاء نفسها.",
    sub: "حجز المواعيد عبر الإنترنت، ملفّات مرضى مُشفّرة، وتذكيرات عبر واتساب بالدارجة. مصمَّمة للأطباء ومسيّري العيادات في المغرب.",
    ctaPrimary: "افتح حسابًا",
    ctaSecondary: "شاهد عرضًا",
    captions: ["٠١ — المواعيد", "٠٢ — ملف مُشفّر", "٠٣ — تذكيرات بالدارجة"],
    trust: {
      uptime: "99,95",
      uptimeLabel: "٪ زمن التشغيل",
      cipher: "AES-256-GCM",
      law: "متوافق مع القانون 09-08",
      latency: "< 200 ms",
    },
  },
  whatsapp: {
    incoming: "تذكير: موعدك غدًا على الساعة 14:30 في العيادة. أجب بـ«نعم» للتأكيد.",
    reply: "نعم",
    status: "مؤكَّد",
  },
  telemetry: {
    rdv: "مواعيد مؤكَّدة اليوم",
    p95: "زمن الاستجابة P95",
    uptime: "زمن التشغيل · 30 يومًا",
    clinics: "عيادات نشطة",
    reminders: "تذكيرات مُرسَلة · 24 ساعة",
  },
  featuresHeading: {
    eyebrow: "المنتج",
    title: "ثلاث يقينيات، بلا أي احتكاك.",
    sub: "كل طبقة تؤدّي مهمّة واحدة بإتقان. لا شيء زائد.",
  },
  features: [
    {
      num: "٠١",
      title: "المواعيد",
      tagline: "صفحة حجز عمومية وعرض أسبوعي موحَّد للعيادة بأكملها.",
      bullets: [
        "حجز المواعيد عبر الإنترنت على مدار الساعة",
        "تأكيدات وتذكيرات تلقائية عبر واتساب",
        "عرض أسبوعي موحَّد لعدّة أطباء",
        "خفض ملموس في حالات التغيّب",
      ],
    },
    {
      num: "٠٢",
      title: "ملف المريض",
      tagline: "خزنة مُشفّرة للتاريخ الطبي والوصفات والوثائق.",
      bullets: [
        "تشفير AES-256-GCM في حالة السكون",
        "سجلّ كامل وقابل للتتبّع",
        "الوصفات والوثائق في مكان واحد",
        "وصول محصور في فريقك فقط",
      ],
    },
    {
      num: "٠٣",
      title: "تذكيرات واتساب",
      tagline: "رسائل بالدارجة، معتمَدة من Meta، تُرسَل في الوقت المناسب.",
      bullets: [
        "10 قوالب بالدارجة معتمَدة من Meta",
        "إرسال تلقائي قبل كل موعد",
        "تأكيد بمجرّد الردّ بـ«نعم»",
        "تغيّب أقل، ووقت رعاية أكثر",
      ],
    },
  ],
  how: {
    eyebrow: "البدء",
    title: "جاهزة في بعد ظهيرة واحدة.",
    sub: "أربع خطوات، دون الحاجة إلى تقني.",
    steps: [
      { num: "٠١", title: "أنشئ حسابك", body: "افتح عيادتك على OLTIGO في دقائق، دون بطاقة بنكية." },
      { num: "٠٢", title: "اضبط عيادتك", body: "الأطباء، الأوقات، أسباب الاستشارة، وصفحة الحجز." },
      { num: "٠٣", title: "استورد مرضاك", body: "انقل ملفّك الحالي أو أضف مرضاك تدريجيًا." },
      { num: "٠٤", title: "تابع نشاطك", body: "المواعيد والتذكيرات والمؤشّرات في الوقت الحقيقي على شاشة واحدة." },
    ],
  },
  tenant: {
    eyebrow: "البنية",
    title: "كل عيادة في خزنتها الخاصة.",
    sub: "نطاق فرعي مخصَّص لكل عيادة، وبيانات معزولة تمامًا. العيادة المجاورة غير موجودة بالنسبة لعيادتك.",
    rlsTitle: "Row Level Security",
    rlsBody: "العزل مُطبَّق على مستوى قاعدة البيانات: كل استعلام مُرشَّح حسب العيادة. لا تسرّب ممكن بين المستأجرين.",
    subdomains: ["cabinet-a.oltigo.com", "cabinet-b.oltigo.com", "cabinet-c.oltigo.com"],
    isolated: "معزولة",
  },
  testimonials: {
    eyebrow: "ثقة",
    title: "أطبّاء ينامون براحة أكبر.",
    items: [
      {
        quote: "انخفض التغيّب منذ الشهر الأول. يؤكّد المرضى عبر واتساب دون حتى الاتصال بالاستقبال.",
        name: "د. ياسمين برادة",
        role: "طبيبة عامة",
        city: "الدار البيضاء",
        plan: "Professional",
      },
      {
        quote: "أخيرًا ملف مريض لا أخشى فتحه. مُشفّر، واضح، وسريع.",
        name: "د. كريم الفاسي",
        role: "طبيب قلب",
        city: "الرباط",
        plan: "Enterprise",
      },
      {
        quote: "تم التركيب في بعد ظهيرة واحدة. تولّت مساعدتي كل شيء دون تكوين.",
        name: "د. سليمة وزاني",
        role: "طبيبة أطفال",
        city: "مراكش",
        plan: "Starter",
      },
    ],
  },
  pricing: {
    eyebrow: "الأسعار",
    title: "سعر واضح، بالدرهم.",
    sub: "دون التزام. غيّر باقتك متى شئت.",
    perMonth: "/ شهريًا",
    currency: "درهم",
    popular: "الأكثر اختيارًا",
    tiers: [
      {
        id: "free",
        name: "Free",
        price: "0",
        cadence: "/ شهريًا",
        blurb: "للتجربة، بشكل فردي.",
        features: ["طبيب واحد", "صفحة حجز", "50 موعدًا / شهر", "تذكيرات بالبريد"],
        cta: "ابدأ",
      },
      {
        id: "starter",
        name: "Starter",
        price: "199",
        cadence: "/ شهريًا",
        blurb: "للعيادة الفردية.",
        features: ["حتى طبيبين", "مواعيد غير محدودة", "تذكيرات واتساب", "ملف مريض مُشفّر"],
        cta: "اختر Starter",
      },
      {
        id: "professional",
        name: "Professional",
        price: "599",
        cadence: "/ شهريًا",
        blurb: "للعيادة الجماعية.",
        features: ["حتى 8 أطباء", "قوالب دارجة متقدّمة", "إحصائيات النشاط", "دعم ذو أولوية"],
        cta: "اختر Professional",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "999",
        cadence: "/ شهريًا",
        blurb: "للعيادة المتعدّدة التخصّصات.",
        features: ["أطباء غير محدودين", "مواقع متعدّدة", "API وتكاملات", "مرافقة مخصَّصة"],
        cta: "تحدّث مع الفريق",
      },
    ],
    note: "الأسعار دون احتساب الضريبة. الاستضافة والبيانات وفق معيار القانون 09-08.",
  },
  faq: {
    eyebrow: "أسئلة",
    title: "ما تسألنا عنه العيادات.",
    items: [
      { q: "هل بيانات مرضاي آمنة؟", a: "نعم. كل ملف مُشفّر بـ AES-256-GCM في حالة السكون، والوصول محصور في فريقك. العزل بين العيادات مُطبَّق على مستوى قاعدة البيانات." },
      { q: "هل OLTIGO متوافق مع القانون 09-08؟", a: "نعم. تتم معالجة وحفظ البيانات الشخصية وفق متطلّبات القانون 09-08 لحماية البيانات في المغرب." },
      { q: "هل تذكيرات واتساب بالدارجة فعلاً؟", a: "نعم. نوفّر 10 قوالب بالدارجة معتمَدة من Meta وجاهزة للاستعمال، يمكنك تخصيصها." },
      { q: "هل يمكنني استيراد ملف مرضاي الحالي؟", a: "نعم. يمكنك استيراد ملفّك الحالي أو إضافة مرضاك تدريجيًا، دون انقطاع." },
      { q: "كم يستغرق البدء؟", a: "تصبح معظم العيادات جاهزة في بعد ظهيرة واحدة: الحساب، الإعداد، صفحة الحجز، وأوّل التذكيرات." },
      { q: "وماذا لو كان لديّ عدّة أطباء أو مواقع؟", a: "تدعم باقتا Professional وEnterprise العيادات الجماعية والمواقع المتعدّدة، مع نطاق فرعي مخصَّص لكل عيادة." },
      { q: "هل يمكنني تغيير باقتي أو إلغاؤها؟", a: "في أي وقت، دون التزام. تنتقل بين الباقات مباشرة من فضائك." },
      { q: "هل يحتاج مرضاي إلى تثبيت تطبيق؟", a: "لا. يتم الحجز من المتصفّح، وتصل التذكيرات عبر واتساب الذي يستعملونه أصلاً." },
    ],
  },
  cta: {
    eyebrow: "عرض",
    title: "شاهد OLTIGO على عيادتك.",
    sub: "اترك لنا بياناتك: نعرض لك الأساسيات في 20 دقيقة، على حالاتك الواقعية.",
    fields: { clinic: "العيادة", doctor: "الطبيب", phone: "الهاتف", email: "البريد الإلكتروني", city: "المدينة" },
    placeholders: {
      clinic: "عيادة أطلس",
      doctor: "د. الاسم الكامل",
      phone: "06 12 34 56 78",
      email: "you@cabinet.ma",
      city: "الدار البيضاء",
    },
    submit: "اطلب العرض",
    submitting: "جارٍ الإرسال…",
    success: "شكرًا. سنتواصل معك خلال 24 ساعة.",
    error: "حدث خطأ. أعد المحاولة أو راسلنا عبر واتساب.",
    whatsapp: "راسلنا عبر واتساب",
    consent: "بإرسال هذا النموذج، توافق على أن نعاود الاتصال بك بخصوص OLTIGO.",
  },
  footer: {
    tagline: "نظام التشغيل الهادئ للعيادات الطبية في المغرب.",
    columns: [
      { title: "المنتج", links: ["المواعيد", "ملف المريض", "تذكيرات واتساب", "الأسعار"] },
      { title: "الموارد", links: ["التوثيق", "دليل البدء", "الحالة", "سجلّ الإصدارات"] },
      { title: "الشركة", links: ["من نحن", "اتصل بنا", "وظائف", "شركاء"] },
      { title: "قانوني", links: ["الخصوصية", "الشروط", "القانون 09-08", "الأمان"] },
    ],
    rights: "جميع الحقوق محفوظة.",
    law: "البيانات مُستضافة ومعالَجة وفق القانون 09-08.",
  },
};

/* ========================================================================== */
/* ENGLISH                                                                    */
/* ========================================================================== */
const en: Dictionary = {
  nav: {
    status: "All systems operational",
    login: "Log in",
    openAccount: "Open an account",
    menu: "Menu",
    sections: { features: "Features", how: "How it works", pricing: "Pricing", faq: "FAQ" },
  },
  hero: {
    eyebrow: "Platform for medical practices · Morocco",
    titleLead: "The calm of a practice",
    titleAccent: "that runs itself.",
    sub: "Online booking, encrypted patient records, and WhatsApp reminders in Darija. Built for doctors and clinic managers across Morocco.",
    ctaPrimary: "Open an account",
    ctaSecondary: "See a demo",
    captions: ["01 — Appointments", "02 — Encrypted record", "03 — Darija reminders"],
    trust: {
      uptime: "99.95",
      uptimeLabel: "% uptime",
      cipher: "AES-256-GCM",
      law: "Law 09-08 compliant",
      latency: "< 200 ms",
    },
  },
  whatsapp: {
    incoming: "Reminder: appointment tomorrow 2:30 PM at the clinic. Reply YES to confirm.",
    reply: "YES",
    status: "Confirmed",
  },
  telemetry: {
    rdv: "Appointments confirmed today",
    p95: "P95 latency",
    uptime: "Uptime · 30d",
    clinics: "Active clinics",
    reminders: "Reminders sent · 24h",
  },
  featuresHeading: {
    eyebrow: "The product",
    title: "Three certainties, zero friction.",
    sub: "Each layer does one thing, perfectly. Nothing superfluous.",
  },
  features: [
    {
      num: "01",
      title: "Appointments",
      tagline: "A public booking page and one unified week view for the whole practice.",
      bullets: [
        "Online booking, around the clock",
        "Automatic WhatsApp confirmations and reminders",
        "Unified, multi-practitioner week view",
        "A measurable drop in no-shows",
      ],
    },
    {
      num: "02",
      title: "Patient record",
      tagline: "An encrypted vault for history, prescriptions, and documents.",
      bullets: [
        "AES-256-GCM encryption at rest",
        "Complete, traceable history",
        "Prescriptions and documents in one place",
        "Access restricted to your team",
      ],
    },
    {
      num: "03",
      title: "WhatsApp reminders",
      tagline: "Darija messages, Meta-approved, sent at exactly the right moment.",
      bullets: [
        "10 Meta-approved Darija templates",
        "Automatic send before every appointment",
        "Confirm with a simple \u201cYES\u201d reply",
        "Fewer no-shows, more care time",
      ],
    },
  ],
  how: {
    eyebrow: "Getting started",
    title: "Live in a single afternoon.",
    sub: "Four steps, no IT person required.",
    steps: [
      { num: "01", title: "Create your account", body: "Open your practice on OLTIGO in minutes, no credit card." },
      { num: "02", title: "Configure your practice", body: "Practitioners, hours, visit reasons, and your booking page." },
      { num: "03", title: "Import your patients", body: "Bring over your existing file or add patients as you go." },
      { num: "04", title: "Track your activity", body: "Appointments, reminders, and metrics in real time on one screen." },
    ],
  },
  tenant: {
    eyebrow: "Architecture",
    title: "Every practice in its own vault.",
    sub: "A dedicated subdomain per clinic, data strictly partitioned. The practice next door does not exist for yours.",
    rlsTitle: "Row Level Security",
    rlsBody: "Isolation is enforced at the database layer: every query is filtered by clinic. No leakage is possible between tenants.",
    subdomains: ["cabinet-a.oltigo.com", "cabinet-b.oltigo.com", "cabinet-c.oltigo.com"],
    isolated: "Isolated",
  },
  testimonials: {
    eyebrow: "Trust",
    title: "Practitioners who sleep better.",
    items: [
      {
        quote: "No-shows dropped in the first month. Patients confirm on WhatsApp without even calling the front desk.",
        name: "Dr. Yasmine Berrada",
        role: "General practitioner",
        city: "Casablanca",
        plan: "Professional",
      },
      {
        quote: "Finally a patient record I\u2019m not afraid to open. Encrypted, clear, fast.",
        name: "Dr. Karim El Fassi",
        role: "Cardiologist",
        city: "Rabat",
        plan: "Enterprise",
      },
      {
        quote: "Set up in one afternoon. My assistant took it all in hand with no training.",
        name: "Dr. Salima Ouazzani",
        role: "Pediatrician",
        city: "Marrakech",
        plan: "Starter",
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Clear pricing, in dirhams.",
    sub: "No commitment. Change plan whenever you like.",
    perMonth: "/ month",
    currency: "MAD",
    popular: "Most chosen",
    tiers: [
      {
        id: "free",
        name: "Free",
        price: "0",
        cadence: "/ month",
        blurb: "To try it, solo.",
        features: ["1 practitioner", "Booking page", "50 appointments / month", "Email reminders"],
        cta: "Get started",
      },
      {
        id: "starter",
        name: "Starter",
        price: "199",
        cadence: "/ month",
        blurb: "For the individual practice.",
        features: ["Up to 2 practitioners", "Unlimited appointments", "WhatsApp reminders", "Encrypted patient record"],
        cta: "Choose Starter",
      },
      {
        id: "professional",
        name: "Professional",
        price: "599",
        cadence: "/ month",
        blurb: "For the group practice.",
        features: ["Up to 8 practitioners", "Advanced Darija templates", "Activity analytics", "Priority support"],
        cta: "Choose Professional",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "999",
        cadence: "/ month",
        blurb: "For the polyclinic.",
        features: ["Unlimited practitioners", "Multi-site", "API & integrations", "Dedicated onboarding"],
        cta: "Talk to the team",
      },
    ],
    note: "Prices excl. tax. Hosting and data to the Law 09-08 standard.",
  },
  faq: {
    eyebrow: "Questions",
    title: "What practices ask us.",
    items: [
      { q: "Is my patient data secure?", a: "Yes. Every record is encrypted with AES-256-GCM at rest, and access is strictly limited to your team. Isolation between practices is enforced at the database layer." },
      { q: "Is OLTIGO compliant with Law 09-08?", a: "Yes. Processing and storage of personal data follow the requirements of Morocco\u2019s Law 09-08 on data protection." },
      { q: "Are the WhatsApp reminders really in Darija?", a: "Yes. We provide 10 Meta-approved Darija templates, ready to use, which you can customize." },
      { q: "Can I import my existing patient file?", a: "Yes. You can import your existing file or add patients gradually, with no interruption." },
      { q: "How long does it take to start?", a: "Most practices are live in one afternoon: account, configuration, booking page, and first reminders." },
      { q: "What if I have several practitioners or sites?", a: "The Professional and Enterprise plans handle group practices and multi-site, with a dedicated subdomain per clinic." },
      { q: "Can I change or cancel my plan?", a: "Anytime, no commitment. You switch plans directly from your workspace." },
      { q: "Do my patients need to install an app?", a: "No. Booking happens in a browser, and reminders arrive on WhatsApp, which they already use." },
    ],
  },
  cta: {
    eyebrow: "Demo",
    title: "See OLTIGO on your practice.",
    sub: "Leave your details: we\u2019ll show you the essentials in 20 minutes, on your real cases.",
    fields: { clinic: "Clinic", doctor: "Doctor", phone: "Phone", email: "Email", city: "City" },
    placeholders: {
      clinic: "Atlas Clinic",
      doctor: "Dr. First Last",
      phone: "06 12 34 56 78",
      email: "you@clinic.ma",
      city: "Casablanca",
    },
    submit: "Request the demo",
    submitting: "Sending\u2026",
    success: "Thank you. We\u2019ll be in touch within 24 hours.",
    error: "Something went wrong. Try again or message us on WhatsApp.",
    whatsapp: "Message on WhatsApp",
    consent: "By submitting this form, you agree to be contacted about OLTIGO.",
  },
  footer: {
    tagline: "The quiet operating system for medical practices in Morocco.",
    columns: [
      { title: "Product", links: ["Appointments", "Patient record", "WhatsApp reminders", "Pricing"] },
      { title: "Resources", links: ["Documentation", "Getting started", "Status", "Changelog"] },
      { title: "Company", links: ["About", "Contact", "Careers", "Partners"] },
      { title: "Legal", links: ["Privacy", "Terms", "Law 09-08", "Security"] },
    ],
    rights: "All rights reserved.",
    law: "Data hosted and processed in accordance with Law 09-08.",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { fr, ar, en };
