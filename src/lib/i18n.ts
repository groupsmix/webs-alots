/**
 * Internationalization (i18n) for Morocco
 *
 * Supports: French (fr), Arabic (ar), Darija phrases
 * RTL support for Arabic interface
 */

export type Locale = "fr" | "ar" | "en";

export type TranslationKey = keyof typeof translations.fr;

// ---- Translations ----

export const translations = {
  fr: {
    // Navigation
    "nav.home": "Accueil",
    "nav.services": "Services",
    "nav.about": "À propos",
    "nav.contact": "Contact",
    "nav.book": "Prendre rendez-vous",
    "nav.login": "Connexion",
    "nav.register": "Inscription",
    "nav.dashboard": "Tableau de bord",
    "nav.patients": "Patients",
    "nav.appointments": "Rendez-vous",
    "nav.prescriptions": "Ordonnances",
    "nav.invoices": "Factures",
    "nav.settings": "Paramètres",
    "nav.waitingRoom": "Salle d'attente",

    // Common actions
    "action.save": "Enregistrer",
    "action.cancel": "Annuler",
    "action.delete": "Supprimer",
    "action.edit": "Modifier",
    "action.search": "Rechercher",
    "action.filter": "Filtrer",
    "action.export": "Exporter",
    "action.print": "Imprimer",
    "action.download": "Télécharger",
    "action.send": "Envoyer",
    "action.confirm": "Confirmer",
    "action.back": "Retour",
    "action.next": "Suivant",
    "action.close": "Fermer",
    "action.add": "Ajouter",
    "action.bookAppointment": "Prendre rendez-vous",

    // Booking
    "booking.title": "Prendre rendez-vous",
    "booking.selectDoctor": "Choisir un médecin",
    "booking.selectService": "Choisir un service",
    "booking.selectDate": "Choisir une date",
    "booking.selectTime": "Choisir un horaire",
    "booking.confirm": "Confirmer le rendez-vous",
    "booking.walkIn": "Sans rendez-vous",
    "booking.emergency": "Urgence",

    // Payment
    "payment.title": "Paiement",
    "payment.amount": "Montant",
    "payment.method": "Mode de paiement",
    "payment.cash": "Espèces",
    "payment.card": "Carte CMI",
    "payment.cashplus": "CashPlus",
    "payment.wafacash": "Wafacash",
    "payment.baridbank": "Barid Bank",
    "payment.transfer": "Virement bancaire",
    "payment.check": "Chèque",
    "payment.insurance": "Tiers payant",
    "payment.installments": "Paiement en plusieurs fois",
    "payment.deposit": "Acompte",
    "payment.fullPayment": "Paiement intégral",
    "payment.resteACharge": "Reste à charge",

    // Invoice
    "invoice.title": "Facture",
    "invoice.number": "N° Facture",
    "invoice.date": "Date",
    "invoice.patient": "Patient",
    "invoice.service": "Service",
    "invoice.amountHT": "Montant HT",
    "invoice.tva": "TVA (20%)",
    "invoice.amountTTC": "Montant TTC",
    "invoice.paid": "Payé",
    "invoice.pending": "En attente",
    "invoice.overdue": "En retard",

    // Insurance
    "insurance.title": "Assurance",
    "insurance.cnss": "CNSS",
    "insurance.cnops": "CNOPS",
    "insurance.amo": "AMO",
    "insurance.mutuelle": "Mutuelle",
    "insurance.affiliationNumber": "N° d'affiliation",
    "insurance.coverage": "Taux de couverture",
    "insurance.resteACharge": "Reste à charge",

    // Prescription
    "prescription.title": "Ordonnance",
    "prescription.medication": "Médicament",
    "prescription.dosage": "Posologie",
    "prescription.duration": "Durée",
    "prescription.instructions": "Instructions",
    "prescription.dci": "DCI",
    "prescription.print": "Imprimer l'ordonnance",
    "prescription.sendWhatsApp": "Envoyer par WhatsApp",

    // Waiting Room
    "waitingRoom.title": "Salle d'attente",
    "waitingRoom.yourTurn": "Votre tour",
    "waitingRoom.position": "Position dans la file",
    "waitingRoom.estimatedWait": "Temps d'attente estimé",
    "waitingRoom.nextPatient": "Patient suivant",
    "waitingRoom.inConsultation": "En consultation",

    // Garde / On-duty
    "garde.title": "Planning de garde",
    "garde.garde": "Garde",
    "garde.astreinte": "Astreinte",
    "garde.nightShift": "Garde de nuit",
    "garde.weekendShift": "Garde week-end",

    // Ramadan
    "ramadan.mode": "Mode Ramadan",
    "ramadan.hours": "Horaires Ramadan",
    "ramadan.active": "Mode Ramadan activé",

    // Carnet de santé
    "carnet.title": "Carnet de santé",
    "carnet.vaccinations": "Vaccinations",
    "carnet.allergies": "Allergies",
    "carnet.chronicConditions": "Maladies chroniques",
    "carnet.bloodType": "Groupe sanguin",
    "carnet.emergencyContact": "Contact d'urgence",

    // Directory
    "directory.title": "Annuaire des médecins",
    "directory.searchPlaceholder": "Rechercher un médecin...",
    "directory.filterByCity": "Filtrer par ville",
    "directory.filterBySpecialty": "Filtrer par spécialité",
    "directory.noResults": "Aucun résultat trouvé",

    // Accounting
    "accounting.title": "Comptabilité",
    "accounting.revenue": "Chiffre d'affaires",
    "accounting.expenses": "Dépenses",
    "accounting.profit": "Bénéfice",
    "accounting.exportDGI": "Export DGI",
    "accounting.fiscYear": "Année fiscale",
  },

  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.services": "الخدمات",
    "nav.about": "من نحن",
    "nav.contact": "اتصل بنا",
    "nav.book": "حجز موعد",
    "nav.login": "تسجيل الدخول",
    "nav.register": "التسجيل",
    "nav.dashboard": "لوحة التحكم",
    "nav.patients": "المرضى",
    "nav.appointments": "المواعيد",
    "nav.prescriptions": "الوصفات الطبية",
    "nav.invoices": "الفواتير",
    "nav.settings": "الإعدادات",
    "nav.waitingRoom": "قاعة الانتظار",

    // Common actions
    "action.save": "حفظ",
    "action.cancel": "إلغاء",
    "action.delete": "حذف",
    "action.edit": "تعديل",
    "action.search": "بحث",
    "action.filter": "تصفية",
    "action.export": "تصدير",
    "action.print": "طباعة",
    "action.download": "تحميل",
    "action.send": "إرسال",
    "action.confirm": "تأكيد",
    "action.back": "رجوع",
    "action.next": "التالي",
    "action.close": "إغلاق",
    "action.add": "إضافة",
    "action.bookAppointment": "حجز موعد",

    // Booking
    "booking.title": "حجز موعد",
    "booking.selectDoctor": "اختر طبيب",
    "booking.selectService": "اختر خدمة",
    "booking.selectDate": "اختر تاريخ",
    "booking.selectTime": "اختر وقت",
    "booking.confirm": "تأكيد الموعد",
    "booking.walkIn": "بدون موعد",
    "booking.emergency": "طوارئ",

    // Payment
    "payment.title": "الدفع",
    "payment.amount": "المبلغ",
    "payment.method": "طريقة الدفع",
    "payment.cash": "نقدا",
    "payment.card": "بطاقة CMI",
    "payment.cashplus": "كاش بلوس",
    "payment.wafacash": "وفاكاش",
    "payment.baridbank": "بريد بنك",
    "payment.transfer": "تحويل بنكي",
    "payment.check": "شيك",
    "payment.insurance": "التأمين",
    "payment.installments": "الدفع بالتقسيط",
    "payment.deposit": "تسبيق",
    "payment.fullPayment": "الدفع الكامل",
    "payment.resteACharge": "المبلغ المتبقي",

    // Invoice
    "invoice.title": "فاتورة",
    "invoice.number": "رقم الفاتورة",
    "invoice.date": "التاريخ",
    "invoice.patient": "المريض",
    "invoice.service": "الخدمة",
    "invoice.amountHT": "المبلغ بدون ضريبة",
    "invoice.tva": "الضريبة على القيمة المضافة (20%)",
    "invoice.amountTTC": "المبلغ شامل الضريبة",
    "invoice.paid": "مدفوع",
    "invoice.pending": "في الانتظار",
    "invoice.overdue": "متأخر",

    // Insurance
    "insurance.title": "التأمين",
    "insurance.cnss": "الصندوق الوطني للضمان الاجتماعي",
    "insurance.cnops": "الصندوق الوطني لمنظمات الاحتياط الاجتماعي",
    "insurance.amo": "التأمين الإجباري عن المرض",
    "insurance.mutuelle": "التعاضدية",
    "insurance.affiliationNumber": "رقم الانخراط",
    "insurance.coverage": "نسبة التغطية",
    "insurance.resteACharge": "المبلغ المتبقي على المريض",

    // Prescription
    "prescription.title": "وصفة طبية",
    "prescription.medication": "الدواء",
    "prescription.dosage": "الجرعة",
    "prescription.duration": "المدة",
    "prescription.instructions": "التعليمات",
    "prescription.dci": "الاسم العلمي",
    "prescription.print": "طباعة الوصفة",
    "prescription.sendWhatsApp": "إرسال عبر واتساب",

    // Waiting Room
    "waitingRoom.title": "قاعة الانتظار",
    "waitingRoom.yourTurn": "دورك",
    "waitingRoom.position": "موقعك في الطابور",
    "waitingRoom.estimatedWait": "وقت الانتظار المتوقع",
    "waitingRoom.nextPatient": "المريض التالي",
    "waitingRoom.inConsultation": "في الاستشارة",

    // Garde / On-duty
    "garde.title": "جدول المناوبة",
    "garde.garde": "مناوبة",
    "garde.astreinte": "استعداد",
    "garde.nightShift": "مناوبة ليلية",
    "garde.weekendShift": "مناوبة نهاية الأسبوع",

    // Ramadan
    "ramadan.mode": "وضع رمضان",
    "ramadan.hours": "أوقات رمضان",
    "ramadan.active": "وضع رمضان مفعل",

    // Carnet de santé
    "carnet.title": "الدفتر الصحي",
    "carnet.vaccinations": "التطعيمات",
    "carnet.allergies": "الحساسية",
    "carnet.chronicConditions": "الأمراض المزمنة",
    "carnet.bloodType": "فصيلة الدم",
    "carnet.emergencyContact": "جهة اتصال الطوارئ",

    // Directory
    "directory.title": "دليل الأطباء",
    "directory.searchPlaceholder": "ابحث عن طبيب...",
    "directory.filterByCity": "تصفية حسب المدينة",
    "directory.filterBySpecialty": "تصفية حسب التخصص",
    "directory.noResults": "لم يتم العثور على نتائج",

    // Accounting
    "accounting.title": "المحاسبة",
    "accounting.revenue": "رقم المعاملات",
    "accounting.expenses": "المصاريف",
    "accounting.profit": "الربح",
    "accounting.exportDGI": "تصدير للمديرية العامة للضرائب",
    "accounting.fiscYear": "السنة المالية",
  },

  en: {
    // Navigation
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.book": "Book Appointment",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.dashboard": "Dashboard",
    "nav.patients": "Patients",
    "nav.appointments": "Appointments",
    "nav.prescriptions": "Prescriptions",
    "nav.invoices": "Invoices",
    "nav.settings": "Settings",
    "nav.waitingRoom": "Waiting Room",

    // Common actions
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.search": "Search",
    "action.filter": "Filter",
    "action.export": "Export",
    "action.print": "Print",
    "action.download": "Download",
    "action.send": "Send",
    "action.confirm": "Confirm",
    "action.back": "Back",
    "action.next": "Next",
    "action.close": "Close",
    "action.add": "Add",
    "action.bookAppointment": "Book Appointment",

    // Booking
    "booking.title": "Book Appointment",
    "booking.selectDoctor": "Select Doctor",
    "booking.selectService": "Select Service",
    "booking.selectDate": "Select Date",
    "booking.selectTime": "Select Time",
    "booking.confirm": "Confirm Appointment",
    "booking.walkIn": "Walk-in",
    "booking.emergency": "Emergency",

    // Payment
    "payment.title": "Payment",
    "payment.amount": "Amount",
    "payment.method": "Payment Method",
    "payment.cash": "Cash",
    "payment.card": "CMI Card",
    "payment.cashplus": "CashPlus",
    "payment.wafacash": "Wafacash",
    "payment.baridbank": "Barid Bank",
    "payment.transfer": "Bank Transfer",
    "payment.check": "Check",
    "payment.insurance": "Insurance",
    "payment.installments": "Installment Payments",
    "payment.deposit": "Deposit",
    "payment.fullPayment": "Full Payment",
    "payment.resteACharge": "Patient Copay",

    // Invoice
    "invoice.title": "Invoice",
    "invoice.number": "Invoice #",
    "invoice.date": "Date",
    "invoice.patient": "Patient",
    "invoice.service": "Service",
    "invoice.amountHT": "Amount (excl. tax)",
    "invoice.tva": "TVA (20%)",
    "invoice.amountTTC": "Amount (incl. tax)",
    "invoice.paid": "Paid",
    "invoice.pending": "Pending",
    "invoice.overdue": "Overdue",

    // Insurance
    "insurance.title": "Insurance",
    "insurance.cnss": "CNSS",
    "insurance.cnops": "CNOPS",
    "insurance.amo": "AMO",
    "insurance.mutuelle": "Mutuelle",
    "insurance.affiliationNumber": "Affiliation Number",
    "insurance.coverage": "Coverage Rate",
    "insurance.resteACharge": "Patient Copay",

    // Prescription
    "prescription.title": "Prescription",
    "prescription.medication": "Medication",
    "prescription.dosage": "Dosage",
    "prescription.duration": "Duration",
    "prescription.instructions": "Instructions",
    "prescription.dci": "INN (DCI)",
    "prescription.print": "Print Prescription",
    "prescription.sendWhatsApp": "Send via WhatsApp",

    // Waiting Room
    "waitingRoom.title": "Waiting Room",
    "waitingRoom.yourTurn": "Your Turn",
    "waitingRoom.position": "Position in Queue",
    "waitingRoom.estimatedWait": "Estimated Wait",
    "waitingRoom.nextPatient": "Next Patient",
    "waitingRoom.inConsultation": "In Consultation",

    // Garde / On-duty
    "garde.title": "On-Duty Schedule",
    "garde.garde": "On-Duty",
    "garde.astreinte": "On-Call",
    "garde.nightShift": "Night Shift",
    "garde.weekendShift": "Weekend Shift",

    // Ramadan
    "ramadan.mode": "Ramadan Mode",
    "ramadan.hours": "Ramadan Hours",
    "ramadan.active": "Ramadan Mode Active",

    // Carnet de santé
    "carnet.title": "Health Booklet",
    "carnet.vaccinations": "Vaccinations",
    "carnet.allergies": "Allergies",
    "carnet.chronicConditions": "Chronic Conditions",
    "carnet.bloodType": "Blood Type",
    "carnet.emergencyContact": "Emergency Contact",

    // Directory
    "directory.title": "Doctor Directory",
    "directory.searchPlaceholder": "Search for a doctor...",
    "directory.filterByCity": "Filter by City",
    "directory.filterBySpecialty": "Filter by Specialty",
    "directory.noResults": "No results found",

    // Accounting
    "accounting.title": "Accounting",
    "accounting.revenue": "Revenue",
    "accounting.expenses": "Expenses",
    "accounting.profit": "Profit",
    "accounting.exportDGI": "Export for DGI",
    "accounting.fiscYear": "Fiscal Year",
  },
} as const;

/**
 * Get a translation string for the given locale and key.
 */
export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations.fr[key] ?? key;
}

/**
 * Check if locale is RTL (Arabic).
 */
export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

/**
 * Get the HTML dir attribute value for a locale.
 */
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return isRTL(locale) ? "rtl" : "ltr";
}

/**
 * Common Darija phrases used in the UI.
 * These are mixed Arabic/French as spoken in Morocco.
 */
export const DARIJA_PHRASES = {
  welcome: "مرحبا بيك",          // Welcome
  bookNow: "حجز موعد",           // Book appointment
  callUs: "عيطو لينا",           // Call us
  thankYou: "شكرا ليك",          // Thank you
  yourTurn: "جا دورك",           // It's your turn
  pleaseWait: "تسنى شوية",       // Please wait
  noWorries: "ماشي مشكل",        // No worries
  seeYouSoon: "نشوفوك قريب",     // See you soon
  howAreYou: "لاباس عليك؟",      // How are you?
  getWell: "الله يشافيك",        // Get well soon
} as const;
