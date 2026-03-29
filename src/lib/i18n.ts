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

    // Landing page
    "landing.badge": "Plateforme SaaS pour professionnels de santé",
    "landing.heroTitle1": "La plateforme complète pour gérer votre ",
    "landing.heroTitle2": "cabinet médical",
    "landing.heroSubtitle": "Créez le site de votre cabinet, gérez les rendez-vous et développez votre activité facilement.",
    "landing.ctaPrimary": "Commencer gratuitement",
    "landing.ctaSecondary": "Voir comment ça marche",
    "landing.ctaPricing": "Voir les tarifs",
    "landing.pillAppointments": "Rendez-vous en ligne",
    "landing.pillPatients": "Gestion patients",
    "landing.pillWebsite": "Site web inclus",
    "landing.trustText": "Utilisé par des médecins et cabinets pour gérer leurs rendez-vous efficacement",
    "landing.trustAppointments": "Gestion intelligente des rendez-vous",
    "landing.trustPatients": "Suivi des patients",
    "landing.trustWebsite": "Site professionnel pour votre cabinet",
    "landing.trustSecurity": "Sécurité des données",
    "landing.featuresLabel": "Fonctionnalités",
    "landing.featuresTitle": "Tout ce dont votre cabinet a besoin",
    "landing.featuresSubtitle": "Des outils simples et puissants pour vous concentrer sur l'essentiel : vos patients.",
    "landing.featureAppointmentsTitle": "Gestion des rendez-vous",
    "landing.featureAppointmentsDesc": "Planifiez, confirmez et suivez tous vos rendez-vous depuis une seule interface intuitive.",
    "landing.featurePatientsTitle": "Gestion des patients",
    "landing.featurePatientsDesc": "Dossiers patients complets, historique des visites et suivi médical centralisé.",
    "landing.featureWebsiteTitle": "Site web du cabinet",
    "landing.featureWebsiteDesc": "Un site professionnel prêt à l'emploi, accessible sur mobile et ordinateur.",
    "landing.featureAutomationTitle": "Automatisation intelligente",
    "landing.featureAutomationDesc": "Rappels automatiques, notifications et gestion de la liste d'attente.",
    "landing.howLabel": "Simple et rapide",
    "landing.howTitle": "Comment ça marche",
    "landing.howSubtitle": "Lancez votre présence en ligne en 4 étapes simples.",
    "landing.howStep": "Étape",
    "landing.howStep1Title": "Créez votre compte",
    "landing.howStep1Desc": "Inscrivez-vous en quelques secondes et configurez votre cabinet.",
    "landing.howStep2Title": "Ajoutez vos services",
    "landing.howStep2Desc": "Définissez vos consultations, tarifs et horaires de travail.",
    "landing.howStep3Title": "Partagez votre lien",
    "landing.howStep3Desc": "Envoyez votre lien unique à vos patients pour réserver.",
    "landing.howStep4Title": "Recevez des rendez-vous",
    "landing.howStep4Desc": "Les patients réservent en ligne, vous gérez tout depuis votre tableau de bord.",
    "landing.demoLabel": "Exemple en direct",
    "landing.demoTitle": "Voyez le résultat",
    "landing.demoSubtitle": "Découvrez à quoi ressemble un site de cabinet créé avec Oltigo.",
    "landing.demoClinic": "Dr. Ahmed - Cabinet Médical",
    "landing.demoSpecialty": "Médecine Générale",
    "landing.demoCity": "Casablanca",
    "landing.demoServices": "Services",
    "landing.demoServicesCount": "5 disponibles",
    "landing.demoAppointments": "Rendez-vous",
    "landing.demoAppointmentsAvail": "En ligne 24/7",
    "landing.demoReviews": "Avis",
    "landing.demoReviewsLabel": "Patients vérifiés",
    "landing.demoViewSite": "Voir le site en direct",
    "landing.ctaTitle": "Lancez votre cabinet en ligne dès aujourd'hui",
    "landing.ctaSubtitle": "Rejoignez les professionnels de santé qui simplifient la gestion de leur cabinet avec Oltigo.",
    "landing.footerAbout": "À propos",
    "landing.footerPricing": "Tarifs",
    "landing.footerContact": "Contact",
    "landing.footerLogin": "Connexion",
    "landing.footerPrivacy": "Confidentialité",
    "landing.footerTerms": "CGU",
    "landing.footerCopyright": "Tous droits réservés.",
    "landing.tryDemo": "Essayer la démo",
    "landing.tryDemoSubtitle": "Testez gratuitement avec des données de démonstration",
    "landing.navFeatures": "Fonctionnalités",
    "landing.navHow": "Comment ça marche",
    "landing.navDemo": "Démo",
    "landing.navPricing": "Tarifs",
    "landing.menuOpen": "Ouvrir le menu",
    "landing.menuClose": "Fermer le menu",

    // Pricing page
    "pricing.label": "Tarifs",
    "pricing.title": "Un plan pour chaque cabinet",
    "pricing.subtitle": "Commencez gratuitement et évoluez selon vos besoins. Tous les plans incluent un site web professionnel et la gestion des rendez-vous.",
    "pricing.popular": "Populaire",
    "pricing.free": "Gratuit",
    "pricing.perMonth": "/mois",
    "pricing.perYear": "/an",
    "pricing.savings": "d'économie",
    "pricing.doctor": "médecin",
    "pricing.doctors": "médecins",
    "pricing.patients": "patients",
    "pricing.appointmentsPerMonth": "RDV/mois",
    "pricing.unlimited": "Illimité",
    "pricing.ctaFree": "Commencer gratuitement",
    "pricing.ctaChoose": "Choisir ce plan",
    "pricing.ctaContact": "Nous contacter",
    "pricing.faqTitle": "Questions fréquentes",
    "pricing.faq1Q": "Puis-je changer de plan à tout moment ?",
    "pricing.faq1A": "Oui, vous pouvez passer à un plan supérieur ou inférieur à tout moment. La différence sera calculée au prorata.",
    "pricing.faq2Q": "Le plan gratuit est-il vraiment gratuit ?",
    "pricing.faq2A": "Absolument. Le plan Free est gratuit pour toujours, sans carte de crédit requise. Il inclut jusqu'à 2 médecins et 50 patients.",
    "pricing.faq3Q": "Comment fonctionne la facturation ?",
    "pricing.faq3A": "La facturation est mensuelle ou annuelle, au choix. Les plans annuels bénéficient d'une réduction d'environ 17%.",
    "pricing.faq4Q": "Quels moyens de paiement acceptez-vous ?",
    "pricing.faq4A": "Nous acceptons les cartes bancaires (CMI) et les virements bancaires pour les plans annuels.",

    // Auth / rate-limit errors
    "auth.rateLimitLogin": "Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.",
    "auth.accountLocked": "Ce compte est temporairement verrouillé suite à de nombreuses tentatives échouées. Veuillez réessayer plus tard.",
    "auth.rateLimitOtp": "Trop de demandes de code. Veuillez réessayer dans quelques minutes.",
    "auth.rateLimitGeneric": "Trop de demandes. Veuillez réessayer dans quelques minutes.",
    "auth.genericError": "Une erreur est survenue",
    "auth.invalidCredentials": "Identifiants de connexion invalides.",
    "auth.phoneDisabled": "L'inscription par téléphone est temporairement désactivée. Veuillez réessayer plus tard.",

    // Chatbot
    "chatbot.error": "Désolé, une erreur est survenue. Veuillez réessayer.",

    // Auth pages
    "error.unexpected": "Une erreur inattendue s'est produite. Veuillez réessayer.",

    // Contact form
    "contact.title": "Envoyez-nous un message",
    "contact.name": "Nom complet",
    "contact.namePlaceholder": "Votre nom",
    "contact.phone": "Téléphone",
    "contact.email": "Email",
    "contact.subject": "Objet",
    "contact.subjectPlaceholder": "Comment pouvons-nous vous aider ?",
    "contact.message": "Message",
    "contact.messagePlaceholder": "Votre message...",
    "contact.submit": "Envoyer le message",
    "contact.submitting": "Envoi en cours...",
    "contact.successTitle": "Message envoyé",
    "contact.successMessage": "Merci pour votre message. Nous vous répondrons dans les plus brefs délais.",
    "contact.sendAnother": "Envoyer un autre message",

    // Booking form
    "booking.submitting": "Envoi en cours…",
    "booking.next": "Suivant",

    // Error pages
    "error.title": "Une erreur est survenue",
    "error.description": "Une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support si le problème persiste.",
    "error.criticalDescription": "Une erreur critique s'est produite. Veuillez rafraîchir la page.",
    "error.retry": "Réessayer",
    "error.sectionTitle": "Une erreur est survenue",
    "error.sectionDescription": "Cette section a rencontré un problème. Veuillez réessayer.",
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

    // Landing page
    "landing.badge": "منصة SaaS لمهنيي الصحة",
    "landing.heroTitle1": "المنصة المتكاملة لإدارة ",
    "landing.heroTitle2": "عيادتك الطبية",
    "landing.heroSubtitle": "أنشئ موقع عيادتك، أدر المواعيد وطوّر نشاطك بسهولة.",
    "landing.ctaPrimary": "ابدأ مجانا",
    "landing.ctaSecondary": "شاهد كيف يعمل",
    "landing.ctaPricing": "عرض الأسعار",
    "landing.pillAppointments": "مواعيد عبر الإنترنت",
    "landing.pillPatients": "إدارة المرضى",
    "landing.pillWebsite": "موقع ويب مضمّن",
    "landing.trustText": "يستخدمه أطباء وعيادات لإدارة مواعيدهم بكفاءة",
    "landing.trustAppointments": "إدارة ذكية للمواعيد",
    "landing.trustPatients": "متابعة المرضى",
    "landing.trustWebsite": "موقع احترافي لعيادتك",
    "landing.trustSecurity": "أمان البيانات",
    "landing.featuresLabel": "المميزات",
    "landing.featuresTitle": "كل ما تحتاجه عيادتك",
    "landing.featuresSubtitle": "أدوات بسيطة وقوية للتركيز على الأهم: مرضاك.",
    "landing.featureAppointmentsTitle": "إدارة المواعيد",
    "landing.featureAppointmentsDesc": "خطط، أكد وتابع جميع مواعيدك من واجهة واحدة سهلة الاستخدام.",
    "landing.featurePatientsTitle": "إدارة المرضى",
    "landing.featurePatientsDesc": "ملفات مرضى كاملة، سجل الزيارات ومتابعة طبية مركزية.",
    "landing.featureWebsiteTitle": "موقع العيادة",
    "landing.featureWebsiteDesc": "موقع احترافي جاهز للاستخدام، متاح على الهاتف والحاسوب.",
    "landing.featureAutomationTitle": "أتمتة ذكية",
    "landing.featureAutomationDesc": "تذكيرات تلقائية، إشعارات وإدارة قائمة الانتظار.",
    "landing.howLabel": "بسيط وسريع",
    "landing.howTitle": "كيف يعمل",
    "landing.howSubtitle": "أطلق حضورك الرقمي في 4 خطوات بسيطة.",
    "landing.howStep": "خطوة",
    "landing.howStep1Title": "أنشئ حسابك",
    "landing.howStep1Desc": "سجل في ثوانٍ وهيّئ عيادتك.",
    "landing.howStep2Title": "أضف خدماتك",
    "landing.howStep2Desc": "حدد استشاراتك، أسعارك وأوقات عملك.",
    "landing.howStep3Title": "شارك رابطك",
    "landing.howStep3Desc": "أرسل رابطك الفريد لمرضاك للحجز.",
    "landing.howStep4Title": "استقبل المواعيد",
    "landing.howStep4Desc": "المرضى يحجزون عبر الإنترنت، وأنت تدير كل شيء من لوحة التحكم.",
    "landing.demoLabel": "مثال حي",
    "landing.demoTitle": "شاهد النتيجة",
    "landing.demoSubtitle": "اكتشف كيف يبدو موقع عيادة تم إنشاؤه باستخدام Oltigo.",
    "landing.demoClinic": "د. أحمد - عيادة طبية",
    "landing.demoSpecialty": "طب عام",
    "landing.demoCity": "الدار البيضاء",
    "landing.demoServices": "الخدمات",
    "landing.demoServicesCount": "5 متاحة",
    "landing.demoAppointments": "المواعيد",
    "landing.demoAppointmentsAvail": "متاح 24/7",
    "landing.demoReviews": "التقييمات",
    "landing.demoReviewsLabel": "مرضى موثقون",
    "landing.demoViewSite": "عرض الموقع مباشرة",
    "landing.ctaTitle": "أطلق عيادتك الرقمية اليوم",
    "landing.ctaSubtitle": "انضم لمهنيي الصحة الذين يبسّطون إدارة عياداتهم مع Oltigo.",
    "landing.footerAbout": "من نحن",
    "landing.footerPricing": "الأسعار",
    "landing.footerContact": "اتصل بنا",
    "landing.footerLogin": "تسجيل الدخول",
    "landing.footerPrivacy": "الخصوصية",
    "landing.footerTerms": "الشروط",
    "landing.footerCopyright": "جميع الحقوق محفوظة.",
    "landing.tryDemo": "جرب العرض التجريبي",
    "landing.tryDemoSubtitle": "اختبر مجانا مع بيانات تجريبية",
    "landing.navFeatures": "المميزات",
    "landing.navHow": "كيف يعمل",
    "landing.navDemo": "عرض تجريبي",
    "landing.navPricing": "الأسعار",
    "landing.menuOpen": "فتح القائمة",
    "landing.menuClose": "إغلاق القائمة",

    // Pricing page
    "pricing.label": "الأسعار",
    "pricing.title": "خطة لكل عيادة",
    "pricing.subtitle": "ابدأ مجانا وتطور حسب احتياجاتك. جميع الخطط تشمل موقعا احترافيا وإدارة المواعيد.",
    "pricing.popular": "الأكثر شعبية",
    "pricing.free": "مجاني",
    "pricing.perMonth": "/شهر",
    "pricing.perYear": "/سنة",
    "pricing.savings": "توفير",
    "pricing.doctor": "طبيب",
    "pricing.doctors": "أطباء",
    "pricing.patients": "مرضى",
    "pricing.appointmentsPerMonth": "موعد/شهر",
    "pricing.unlimited": "غير محدود",
    "pricing.ctaFree": "ابدأ مجانا",
    "pricing.ctaChoose": "اختر هذه الخطة",
    "pricing.ctaContact": "اتصل بنا",
    "pricing.faqTitle": "أسئلة متكررة",
    "pricing.faq1Q": "هل يمكنني تغيير الخطة في أي وقت؟",
    "pricing.faq1A": "نعم، يمكنك الترقية أو التخفيض في أي وقت. سيتم حساب الفرق بالتناسب.",
    "pricing.faq2Q": "هل الخطة المجانية مجانية حقا؟",
    "pricing.faq2A": "بالتأكيد. الخطة المجانية مجانية للأبد، بدون بطاقة ائتمان. تشمل حتى طبيبين و50 مريضا.",
    "pricing.faq3Q": "كيف تعمل الفوترة؟",
    "pricing.faq3A": "الفوترة شهرية أو سنوية حسب اختيارك. الخطط السنوية توفر حوالي 17%.",
    "pricing.faq4Q": "ما هي وسائل الدفع المقبولة؟",
    "pricing.faq4A": "نقبل البطاقات البنكية (CMI) والتحويلات البنكية للخطط السنوية.",

    // Auth / rate-limit errors
    "auth.rateLimitLogin": "محاولات تسجيل دخول كثيرة. يرجى المحاولة بعد بضع دقائق.",
    "auth.accountLocked": "تم قفل هذا الحساب مؤقتا بسبب محاولات فاشلة متعددة. يرجى المحاولة لاحقا.",
    "auth.rateLimitOtp": "طلبات كثيرة للرمز. يرجى المحاولة بعد بضع دقائق.",
    "auth.rateLimitGeneric": "طلبات كثيرة. يرجى المحاولة بعد بضع دقائق.",
    "auth.genericError": "حدث خطأ",
    "auth.invalidCredentials": "بيانات تسجيل الدخول غير صحيحة.",
    "auth.phoneDisabled": "التسجيل عبر الهاتف معطّل مؤقتاً. يرجى المحاولة لاحقاً.",

    // Chatbot
    "chatbot.error": "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.",

    // Auth pages
    "error.unexpected": "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",

    // Contact form
    "contact.title": "أرسل لنا رسالة",
    "contact.name": "الاسم الكامل",
    "contact.namePlaceholder": "اسمك",
    "contact.phone": "الهاتف",
    "contact.email": "البريد الإلكتروني",
    "contact.subject": "الموضوع",
    "contact.subjectPlaceholder": "كيف يمكننا مساعدتك؟",
    "contact.message": "الرسالة",
    "contact.messagePlaceholder": "رسالتك...",
    "contact.submit": "إرسال الرسالة",
    "contact.submitting": "جاري الإرسال...",
    "contact.successTitle": "تم إرسال الرسالة",
    "contact.successMessage": "شكرا لرسالتك. سنرد عليك في أقرب وقت.",
    "contact.sendAnother": "إرسال رسالة أخرى",

    // Booking form
    "booking.submitting": "جاري الإرسال…",
    "booking.next": "التالي",

    // Error pages
    "error.title": "حدث خطأ",
    "error.description": "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم إذا استمرت المشكلة.",
    "error.criticalDescription": "حدث خطأ حرج. يرجى تحديث الصفحة.",
    "error.retry": "إعادة المحاولة",
    "error.sectionTitle": "حدث خطأ",
    "error.sectionDescription": "واجه هذا القسم مشكلة. يرجى المحاولة مرة أخرى.",
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

    // Landing page
    "landing.badge": "SaaS Platform for Healthcare Professionals",
    "landing.heroTitle1": "The complete platform to manage your ",
    "landing.heroTitle2": "medical practice",
    "landing.heroSubtitle": "Build your practice website, manage appointments and grow your business easily.",
    "landing.ctaPrimary": "Get started for free",
    "landing.ctaSecondary": "See how it works",
    "landing.ctaPricing": "View pricing",
    "landing.pillAppointments": "Online appointments",
    "landing.pillPatients": "Patient management",
    "landing.pillWebsite": "Website included",
    "landing.trustText": "Used by doctors and clinics to manage their appointments efficiently",
    "landing.trustAppointments": "Smart appointment management",
    "landing.trustPatients": "Patient follow-up",
    "landing.trustWebsite": "Professional website for your practice",
    "landing.trustSecurity": "Data security",
    "landing.featuresLabel": "Features",
    "landing.featuresTitle": "Everything your practice needs",
    "landing.featuresSubtitle": "Simple and powerful tools to focus on what matters most: your patients.",
    "landing.featureAppointmentsTitle": "Appointment Management",
    "landing.featureAppointmentsDesc": "Plan, confirm and track all your appointments from a single intuitive interface.",
    "landing.featurePatientsTitle": "Patient Management",
    "landing.featurePatientsDesc": "Complete patient records, visit history and centralized medical follow-up.",
    "landing.featureWebsiteTitle": "Practice Website",
    "landing.featureWebsiteDesc": "A professional ready-to-use website, accessible on mobile and desktop.",
    "landing.featureAutomationTitle": "Smart Automation",
    "landing.featureAutomationDesc": "Automatic reminders, notifications and waiting list management.",
    "landing.howLabel": "Simple and fast",
    "landing.howTitle": "How it works",
    "landing.howSubtitle": "Launch your online presence in 4 simple steps.",
    "landing.howStep": "Step",
    "landing.howStep1Title": "Create your account",
    "landing.howStep1Desc": "Sign up in seconds and configure your practice.",
    "landing.howStep2Title": "Add your services",
    "landing.howStep2Desc": "Define your consultations, rates and working hours.",
    "landing.howStep3Title": "Share your link",
    "landing.howStep3Desc": "Send your unique link to patients for booking.",
    "landing.howStep4Title": "Receive appointments",
    "landing.howStep4Desc": "Patients book online, you manage everything from your dashboard.",
    "landing.demoLabel": "Live example",
    "landing.demoTitle": "See the result",
    "landing.demoSubtitle": "Discover what a practice website built with Oltigo looks like.",
    "landing.demoClinic": "Dr. Ahmed - Medical Office",
    "landing.demoSpecialty": "General Medicine",
    "landing.demoCity": "Casablanca",
    "landing.demoServices": "Services",
    "landing.demoServicesCount": "5 available",
    "landing.demoAppointments": "Appointments",
    "landing.demoAppointmentsAvail": "Online 24/7",
    "landing.demoReviews": "Reviews",
    "landing.demoReviewsLabel": "Verified patients",
    "landing.demoViewSite": "View live site",
    "landing.ctaTitle": "Launch your practice online today",
    "landing.ctaSubtitle": "Join healthcare professionals who simplify their practice management with Oltigo.",
    "landing.footerAbout": "About",
    "landing.footerPricing": "Pricing",
    "landing.footerContact": "Contact",
    "landing.footerLogin": "Login",
    "landing.footerPrivacy": "Privacy",
    "landing.footerTerms": "Terms",
    "landing.footerCopyright": "All rights reserved.",
    "landing.tryDemo": "Try the demo",
    "landing.tryDemoSubtitle": "Test for free with sample data",
    "landing.navFeatures": "Features",
    "landing.navHow": "How it works",
    "landing.navDemo": "Demo",
    "landing.navPricing": "Pricing",
    "landing.menuOpen": "Open menu",
    "landing.menuClose": "Close menu",

    // Pricing page
    "pricing.label": "Pricing",
    "pricing.title": "A plan for every practice",
    "pricing.subtitle": "Start for free and scale as you grow. All plans include a professional website and appointment management.",
    "pricing.popular": "Popular",
    "pricing.free": "Free",
    "pricing.perMonth": "/month",
    "pricing.perYear": "/year",
    "pricing.savings": "savings",
    "pricing.doctor": "doctor",
    "pricing.doctors": "doctors",
    "pricing.patients": "patients",
    "pricing.appointmentsPerMonth": "appts/month",
    "pricing.unlimited": "Unlimited",
    "pricing.ctaFree": "Get started for free",
    "pricing.ctaChoose": "Choose this plan",
    "pricing.ctaContact": "Contact us",
    "pricing.faqTitle": "Frequently asked questions",
    "pricing.faq1Q": "Can I change plans at any time?",
    "pricing.faq1A": "Yes, you can upgrade or downgrade at any time. The difference will be prorated.",
    "pricing.faq2Q": "Is the free plan really free?",
    "pricing.faq2A": "Absolutely. The Free plan is free forever, no credit card required. It includes up to 2 doctors and 50 patients.",
    "pricing.faq3Q": "How does billing work?",
    "pricing.faq3A": "Billing is monthly or yearly, your choice. Yearly plans save approximately 17%.",
    "pricing.faq4Q": "What payment methods do you accept?",
    "pricing.faq4A": "We accept bank cards (CMI) and bank transfers for yearly plans.",

    // Auth / rate-limit errors
    "auth.rateLimitLogin": "Too many login attempts. Please try again in a few minutes.",
    "auth.accountLocked": "This account is temporarily locked due to multiple failed attempts. Please try again later.",
    "auth.rateLimitOtp": "Too many code requests. Please try again in a few minutes.",
    "auth.rateLimitGeneric": "Too many requests. Please try again in a few minutes.",
    "auth.genericError": "An error occurred",
    "auth.invalidCredentials": "Invalid login credentials.",
    "auth.phoneDisabled": "Phone registration is temporarily disabled. Please try again later.",

    // Chatbot
    "chatbot.error": "Sorry, an error occurred. Please try again.",

    // Auth pages
    "error.unexpected": "An unexpected error occurred. Please try again.",

    // Contact form
    "contact.title": "Send us a message",
    "contact.name": "Full name",
    "contact.namePlaceholder": "Your name",
    "contact.phone": "Phone",
    "contact.email": "Email",
    "contact.subject": "Subject",
    "contact.subjectPlaceholder": "How can we help you?",
    "contact.message": "Message",
    "contact.messagePlaceholder": "Your message...",
    "contact.submit": "Send message",
    "contact.submitting": "Sending...",
    "contact.successTitle": "Message sent",
    "contact.successMessage": "Thank you for your message. We will get back to you shortly.",
    "contact.sendAnother": "Send another message",

    // Booking form
    "booking.submitting": "Sending…",
    "booking.next": "Next",

    // Error pages
    "error.title": "An error occurred",
    "error.description": "An unexpected error occurred. Please try again or contact support if the problem persists.",
    "error.criticalDescription": "A critical error occurred. Please refresh the page.",
    "error.retry": "Retry",
    "error.sectionTitle": "An error occurred",
    "error.sectionDescription": "This section encountered a problem. Please try again.",
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
