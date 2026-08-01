import type { AnalyzedDocument } from "../types";

/**
 * Synthetic demonstration documents. Every person, insurer, program,
 * policy number and amount is FICTIONAL. No real personal information.
 *
 * doc-benefits  — preloaded on first run (the user's existing document)
 * doc-dental    — produced when the user uploads/photographs an image
 * doc-notice    — produced when the user uploads a PDF or text file
 */

export const BENEFITS_DOC: AnalyzedDocument = {
  id: "doc-benefits",
  title: "Extended Health Benefits Confirmation Letter",
  kind: "coverage_letter",
  issuer: "MapleShield Benefits (Demo Insurer)",
  recipient: "Alex Rivera (Demo Person)",
  uploadedAt: "2026-07-28T15:12:00Z",
  status: "ready",
  isImage: false,
  language: "en",
  keyDate: { label: "Coverage expires", date: "2026-12-31" },
  programs: ["Extended Health Benefits Plan — Group 400 (Demo)"],
  plainSummary:
    "This letter confirms that your health benefits plan is active until December 31, 2026. It pays 80% of prescription drug costs up to $2,000 per year, up to $500 per year for physiotherapy, and up to $250 every two years for glasses or contact lenses. Dental care is NOT included in this plan. To keep your coverage next year, you must send in a renewal declaration before November 15, 2026.",
  facts: [
    {
      id: "fact-b-program",
      category: "program",
      label: "Program",
      value: "Extended Health Benefits Plan — Group 400 (Demo)",
      citations: ["seg-b-01"],
      verification: "verified",
    },
    {
      id: "fact-b-policy",
      category: "identifier",
      label: "Policy number",
      value: "PD-DEMO-448812",
      citations: ["seg-b-01"],
      verification: "verified",
    },
    {
      id: "fact-b-start",
      category: "date",
      label: "Coverage start",
      value: "January 1, 2026",
      date: "2026-01-01",
      citations: ["seg-b-02"],
      verification: "verified",
    },
    {
      id: "fact-b-expiry",
      category: "date",
      label: "Coverage expiry",
      value: "December 31, 2026",
      date: "2026-12-31",
      citations: ["seg-b-02"],
      verification: "verified",
    },
    {
      id: "fact-b-drugs",
      category: "coverage",
      label: "Prescription drugs",
      value: "80% covered, up to $2,000 per year",
      citations: ["seg-b-03"],
      verification: "verified",
    },
    {
      id: "fact-b-physio",
      category: "coverage",
      label: "Physiotherapy",
      value: "Up to $500 per year",
      citations: ["seg-b-03"],
      verification: "verified",
    },
    {
      id: "fact-b-vision",
      category: "coverage",
      label: "Vision care",
      value: "Up to $250 every 24 months",
      citations: ["seg-b-03"],
      verification: "verified",
    },
    {
      id: "fact-b-nodental",
      category: "warning",
      label: "Not covered",
      value: "Dental services are excluded from this plan",
      citations: ["seg-b-04"],
      verification: "verified",
    },
    {
      id: "fact-b-renewal",
      category: "action",
      label: "Renewal requirement",
      value: "Submit the renewal declaration form before November 15, 2026",
      date: "2026-11-15",
      citations: ["seg-b-05"],
      verification: "verified",
    },
    {
      id: "fact-b-contact",
      category: "contact",
      label: "Member services",
      value: "1-800-555-0100 · members@mapleshield.demo",
      citations: ["seg-b-06"],
      verification: "verified",
    },
  ],
  steps: [
    {
      order: 1,
      text: "Mark the renewal deadline: your renewal declaration must arrive before November 15, 2026.",
      deadline: "2026-11-15",
      citations: ["seg-b-05"],
    },
    {
      order: 2,
      text: "Keep this letter — it is your proof of current coverage and shows your policy number PD-DEMO-448812.",
      citations: ["seg-b-01"],
    },
    {
      order: 3,
      text: "If you need dental care, note that this plan does not include it. See Coverage insights for a program that may help.",
      citations: ["seg-b-04"],
    },
    {
      order: 4,
      text: "For questions about your plan, call member services at 1-800-555-0100.",
      citations: ["seg-b-06"],
    },
  ],
  translations: [
    {
      language: "fr",
      plainSummary:
        "Cette lettre confirme que votre régime d'avantages santé est actif jusqu'au 31 décembre 2026. Il couvre 80 % des médicaments sur ordonnance jusqu'à 2 000 $ par année, jusqu'à 500 $ par année pour la physiothérapie, et jusqu'à 250 $ tous les deux ans pour des lunettes. Les soins dentaires ne sont PAS inclus. Pour garder votre couverture, envoyez la déclaration de renouvellement avant le 15 novembre 2026.",
      steps: [
        "Notez la date limite : la déclaration de renouvellement doit arriver avant le 15 novembre 2026.",
        "Conservez cette lettre — elle prouve votre couverture actuelle et montre votre numéro de police PD-DEMO-448812.",
        "Ce régime n'inclut pas les soins dentaires. Consultez les pistes de couverture pour un programme qui pourrait aider.",
        "Pour toute question, appelez le service aux membres au 1-800-555-0100.",
      ],
    },
    {
      language: "es",
      plainSummary:
        "Esta carta confirma que su plan de beneficios de salud está activo hasta el 31 de diciembre de 2026. Cubre el 80% de los medicamentos recetados hasta $2,000 por año, hasta $500 por año de fisioterapia y hasta $250 cada dos años para lentes. La atención dental NO está incluida. Para mantener su cobertura, envíe la declaración de renovación antes del 15 de noviembre de 2026.",
      steps: [
        "Marque la fecha límite: su declaración de renovación debe llegar antes del 15 de noviembre de 2026.",
        "Guarde esta carta — es su prueba de cobertura actual y muestra su número de póliza PD-DEMO-448812.",
        "Este plan no incluye atención dental. Revise las oportunidades de cobertura para un programa que podría ayudar.",
        "Si tiene preguntas, llame a servicios para miembros al 1-800-555-0100.",
      ],
    },
  ],
  insights: [
    {
      id: "ins-b-dental",
      programId: "prog-dental",
      headline: "You may be eligible for dental help — this plan excludes dental",
      whyItMayMatch: [
        {
          text: "Your benefits letter states that dental services are excluded from your plan, which is the main requirement of this demo program.",
          citations: ["seg-b-04"],
        },
      ],
      missingInformation: ["Proof of household income"],
      potentialBenefit: "Up to $1,300 per year toward basic dental care (demo figure).",
      confidence: "possible",
    },
    {
      id: "ins-b-copay",
      programId: "prog-copay",
      headline: "Your 20% prescription copay might be reduced",
      whyItMayMatch: [
        {
          text: "Your plan pays 80% of prescription costs, so you pay the remaining 20% — the situation this demo program is designed for.",
          citations: ["seg-b-03"],
        },
      ],
      missingInformation: ["Proof of household income", "Your typical yearly prescription costs"],
      potentialBenefit: "Could reduce the 20% share you pay yourself (demo figure).",
      confidence: "needs_more_information",
    },
  ],
  segments: [
    {
      id: "seg-b-01",
      text: "RE: Extended Health Benefits Plan — Group 400 (Demo). Member: Alex Rivera (Demo Person). Policy number: PD-DEMO-448812.",
    },
    {
      id: "seg-b-02",
      text: "We are pleased to confirm that your coverage is in effect from January 1, 2026 to December 31, 2026.",
    },
    {
      id: "seg-b-03",
      text: "Your plan reimburses eligible prescription drugs at 80% to an annual maximum of $2,000; paramedical services including physiotherapy to an annual maximum of $500; and vision care (prescription eyewear) to a maximum of $250 in any 24-month period.",
    },
    {
      id: "seg-b-04",
      text: "Please note: dental services of any kind are excluded from the Group 400 plan.",
    },
    {
      id: "seg-b-05",
      text: "To maintain coverage for the 2027 plan year, a completed Renewal Declaration (Form RD-27) must be received by our office no later than November 15, 2026.",
    },
    {
      id: "seg-b-06",
      text: "Questions? Contact Member Services at 1-800-555-0100 or members@mapleshield.demo, Monday to Friday, 8am–6pm.",
    },
  ],
  suggestedReminders: [
    {
      title: "Submit benefits renewal declaration (Form RD-27)",
      dueAt: "2026-11-08T09:00:00",
      reason: "Renewal must be received by November 15, 2026 — one week of buffer added.",
    },
  ],
  connections: [],
};

export const DENTAL_FORM_DOC: AnalyzedDocument = {
  id: "doc-dental",
  title: "Community Dental Support Program — Enrollment Form",
  kind: "enrollment_form",
  issuer: "Demo Regional Health Services",
  recipient: "Applicant (blank form)",
  uploadedAt: "", // set at upload time
  status: "ready",
  isImage: true,
  language: "en",
  keyDate: { label: "Submission deadline", date: "2026-09-30" },
  programs: ["Community Dental Support Program (Demo)"],
  plainSummary:
    "This is an application form for a dental assistance program. To apply, you must fill in the form, attach proof of your household income, and attach a statement showing that your current health plan does not include dental care. Your benefits letter from MapleShield works as that statement. The completed package must be received by September 30, 2026. Incomplete applications are returned, which can make you miss the deadline.",
  facts: [
    {
      id: "fact-d-program",
      category: "program",
      label: "Program",
      value: "Community Dental Support Program (Demo)",
      citations: ["seg-d-01"],
      verification: "verified",
    },
    {
      id: "fact-d-deadline",
      category: "date",
      label: "Submission deadline",
      value: "September 30, 2026",
      date: "2026-09-30",
      citations: ["seg-d-04"],
      verification: "verified",
    },
    {
      id: "fact-d-income",
      category: "requirement",
      label: "Required document",
      value: "Proof of household income (e.g. tax assessment)",
      citations: ["seg-d-02"],
      verification: "verified",
    },
    {
      id: "fact-d-coverage-proof",
      category: "requirement",
      label: "Required document",
      value: "Statement confirming your plan excludes dental coverage",
      citations: ["seg-d-03"],
      verification: "verified",
    },
    {
      id: "fact-d-incomplete",
      category: "warning",
      label: "Warning",
      value: "Incomplete applications are returned without processing",
      citations: ["seg-d-04"],
      verification: "verified",
    },
    {
      id: "fact-d-contact",
      category: "contact",
      label: "Program office",
      value: "1-800-555-0134 · dental@demoregion.demo",
      citations: ["seg-d-05"],
      verification: "verified",
    },
  ],
  steps: [
    {
      order: 1,
      text: "Fill in all sections of the enrollment form (sections A through D).",
      citations: ["seg-d-02"],
    },
    {
      order: 2,
      text: "Attach proof of household income, such as your most recent tax assessment.",
      citations: ["seg-d-02"],
    },
    {
      order: 3,
      text: "Attach your MapleShield benefits letter — it is the required proof that your plan excludes dental.",
      citations: ["seg-d-03"],
    },
    {
      order: 4,
      text: "Send the complete package so it arrives before September 30, 2026.",
      deadline: "2026-09-30",
      citations: ["seg-d-04"],
    },
    {
      order: 5,
      text: "If anything is unclear, call the program office at 1-800-555-0134 before submitting.",
      citations: ["seg-d-05"],
    },
  ],
  translations: [
    {
      language: "es",
      plainSummary:
        "Este es un formulario de solicitud para un programa de ayuda dental. Para aplicar, debe completar el formulario, adjuntar prueba de sus ingresos y adjuntar una declaración que muestre que su plan de salud actual no incluye atención dental. Su carta de beneficios de MapleShield sirve como esa declaración. El paquete completo debe recibirse antes del 30 de septiembre de 2026. Las solicitudes incompletas se devuelven, lo que puede hacerle perder la fecha límite.",
      steps: [
        "Complete todas las secciones del formulario (secciones A a D).",
        "Adjunte prueba de ingresos del hogar, como su evaluación de impuestos más reciente.",
        "Adjunte su carta de beneficios de MapleShield — es la prueba requerida de que su plan excluye la atención dental.",
        "Envíe el paquete completo para que llegue antes del 30 de septiembre de 2026.",
        "Si algo no está claro, llame a la oficina del programa al 1-800-555-0134 antes de enviar.",
      ],
    },
    {
      language: "fr",
      plainSummary:
        "Ceci est un formulaire de demande pour un programme d'aide dentaire. Pour postuler, remplissez le formulaire, joignez une preuve de revenu et joignez une déclaration montrant que votre régime de santé actuel n'inclut pas les soins dentaires. Votre lettre de MapleShield sert de déclaration. Le dossier complet doit être reçu avant le 30 septembre 2026. Les demandes incomplètes sont retournées, ce qui peut vous faire manquer la date limite.",
      steps: [
        "Remplissez toutes les sections du formulaire (sections A à D).",
        "Joignez une preuve de revenu du ménage, comme votre plus récent avis de cotisation.",
        "Joignez votre lettre de MapleShield — c'est la preuve requise que votre régime exclut les soins dentaires.",
        "Envoyez le dossier complet pour qu'il arrive avant le 30 septembre 2026.",
        "En cas de doute, appelez le bureau du programme au 1-800-555-0134 avant d'envoyer.",
      ],
    },
    {
      language: "ar",
      plainSummary:
        "هذه استمارة تقديم لبرنامج مساعدة لعلاج الأسنان. للتقديم، يجب ملء الاستمارة، وإرفاق إثبات دخل الأسرة، وإرفاق بيان يوضح أن خطتك الصحية الحالية لا تشمل علاج الأسنان. رسالة المزايا من MapleShield تصلح كهذا البيان. يجب استلام الملف الكامل قبل 30 سبتمبر 2026. الطلبات غير المكتملة تُعاد، مما قد يجعلك تفوّت الموعد النهائي.",
      steps: [
        "املأ جميع أقسام الاستمارة (الأقسام A إلى D).",
        "أرفق إثبات دخل الأسرة، مثل أحدث تقييم ضريبي.",
        "أرفق رسالة المزايا من MapleShield — فهي الإثبات المطلوب بأن خطتك لا تشمل الأسنان.",
        "أرسل الملف الكامل ليصل قبل 30 سبتمبر 2026.",
        "إذا كان هناك شيء غير واضح، اتصل بمكتب البرنامج على 1-800-555-0134 قبل الإرسال.",
      ],
    },
  ],
  insights: [
    {
      id: "ins-d-dental",
      programId: "prog-dental",
      headline: "This form matches a gap in your existing coverage",
      whyItMayMatch: [
        {
          text: "This program requires proof that your plan excludes dental — and your MapleShield letter states exactly that.",
          citations: ["seg-d-03"],
        },
        {
          text: "Based on the information currently available, you already hold one of the two required documents.",
          citations: ["seg-d-03"],
        },
      ],
      missingInformation: ["Proof of household income"],
      potentialBenefit: "Up to $1,300 per year toward basic dental care (demo figure).",
      confidence: "possible",
    },
  ],
  segments: [
    {
      id: "seg-d-01",
      text: "COMMUNITY DENTAL SUPPORT PROGRAM (DEMO) — ENROLLMENT FORM (CDS-1). Administered by Demo Regional Health Services.",
    },
    {
      id: "seg-d-02",
      text: "The applicant shall furnish herewith: (i) the enrollment form completed in its entirety, sections A through D inclusive; (ii) documentation evidencing gross household income for the preceding taxation year.",
    },
    {
      id: "seg-d-03",
      text: "(iii) an attestation or benefits statement from the applicant's extant health benefits carrier demonstrating the absence of dental service coverage thereunder.",
    },
    {
      id: "seg-d-04",
      text: "Applications must be received by the Program Office no later than September 30, 2026. Applications found to be incomplete shall be returned to the applicant without processing.",
    },
    {
      id: "seg-d-05",
      text: "Enquiries: Program Office, 1-800-555-0134, dental@demoregion.demo.",
    },
  ],
  suggestedReminders: [
    {
      title: "Submit dental program application package",
      dueAt: "2026-09-23T09:00:00",
      reason: "Applications must be RECEIVED by September 30, 2026 — one week of mailing buffer added.",
    },
  ],
  connections: [
    {
      text: "Requirement (iii) — proof that your plan excludes dental — is satisfied by your MapleShield benefits letter, which states dental services are excluded.",
      relatedDocumentId: "doc-benefits",
      citations: ["seg-d-03"],
    },
  ],
};

export const NOTICE_DOC: AnalyzedDocument = {
  id: "doc-notice",
  title: "Provincial Assistance — Annual Renewal Notice",
  kind: "government_notice",
  issuer: "Demo Provincial Assistance Office",
  recipient: "Alex Rivera (Demo Person)",
  uploadedAt: "",
  status: "ready",
  isImage: false,
  language: "en",
  keyDate: { label: "Renewal deadline", date: "2026-08-20" },
  programs: ["Provincial Assistance — Health Supplement (Demo)"],
  plainSummary:
    "This notice says your provincial assistance health supplement is up for its yearly renewal. Your file is missing one document: an updated income statement. If it is not received by August 20, 2026, your supplement will pause until the file is complete. Because you receive this supplement, you may also qualify for help with travel costs to medical appointments.",
  facts: [
    {
      id: "fact-n-program",
      category: "program",
      label: "Program",
      value: "Provincial Assistance — Health Supplement (Demo)",
      citations: ["seg-n-01"],
      verification: "verified",
    },
    {
      id: "fact-n-deadline",
      category: "date",
      label: "Renewal deadline",
      value: "August 20, 2026",
      date: "2026-08-20",
      citations: ["seg-n-02"],
      verification: "verified",
    },
    {
      id: "fact-n-missing",
      category: "requirement",
      label: "Missing document",
      value: "Updated income statement for the current year",
      citations: ["seg-n-02"],
      verification: "verified",
    },
    {
      id: "fact-n-pause",
      category: "warning",
      label: "If not renewed",
      value: "The supplement pauses until the file is complete",
      citations: ["seg-n-03"],
      verification: "verified",
    },
    {
      id: "fact-n-contact",
      category: "contact",
      label: "Assistance office",
      value: "1-800-555-0192",
      citations: ["seg-n-04"],
      verification: "verified",
    },
  ],
  steps: [
    {
      order: 1,
      text: "Get an updated income statement for the current year (the same document also works for the dental program application).",
      citations: ["seg-n-02"],
    },
    {
      order: 2,
      text: "Send it to the assistance office so it arrives before August 20, 2026.",
      deadline: "2026-08-20",
      citations: ["seg-n-02"],
    },
    {
      order: 3,
      text: "If you travel to medical appointments, ask about travel cost support when you call — you may qualify because you receive this supplement.",
      citations: ["seg-n-03"],
    },
  ],
  translations: [
    {
      language: "fr",
      plainSummary:
        "Cet avis indique que votre supplément santé de l'aide provinciale doit être renouvelé. Il manque un document à votre dossier : une déclaration de revenu à jour. Si elle n'est pas reçue avant le 20 août 2026, votre supplément sera suspendu jusqu'à ce que le dossier soit complet. Comme vous recevez ce supplément, vous pourriez aussi être admissible à une aide pour les frais de déplacement médicaux.",
      steps: [
        "Obtenez une déclaration de revenu à jour (le même document sert aussi pour la demande du programme dentaire).",
        "Envoyez-la au bureau d'aide pour qu'elle arrive avant le 20 août 2026.",
        "Si vous vous déplacez pour des rendez-vous médicaux, demandez l'aide au transport lors de votre appel.",
      ],
    },
  ],
  insights: [
    {
      id: "ins-n-transport",
      programId: "prog-transport",
      headline: "You may qualify for travel cost support",
      whyItMayMatch: [
        {
          text: "This demo program is for people receiving provincial assistance — and this notice confirms you receive the health supplement.",
          citations: ["seg-n-01", "seg-n-03"],
        },
      ],
      missingInformation: ["Travel receipts or mileage for medical appointments"],
      potentialBenefit: "Reimbursement for bus fare or mileage to medical appointments (demo).",
      confidence: "possible",
    },
  ],
  segments: [
    {
      id: "seg-n-01",
      text: "NOTICE OF ANNUAL RENEWAL — Provincial Assistance Health Supplement (Demo). File: PA-DEMO-77201. Recipient: Alex Rivera (Demo Person).",
    },
    {
      id: "seg-n-02",
      text: "Our records indicate your renewal file is incomplete. Required: an updated income statement for the current year, to be received no later than August 20, 2026.",
    },
    {
      id: "seg-n-03",
      text: "Failure to complete the file by the deadline will result in a pause of the supplement until documentation is received. Supplement recipients may additionally qualify for medical travel reimbursement under the Health Travel Support program.",
    },
    {
      id: "seg-n-04",
      text: "Contact the Assistance Office at 1-800-555-0192 with any questions.",
    },
  ],
  suggestedReminders: [
    {
      title: "Send updated income statement to assistance office",
      dueAt: "2026-08-13T09:00:00",
      reason: "Must be received by August 20, 2026 — one week of buffer added.",
    },
  ],
  connections: [
    {
      text: "The income statement required here is the same document the dental program application asks for — getting it once completes both files.",
      relatedDocumentId: "doc-dental",
      citations: ["seg-n-02"],
    },
  ],
};

export const FIXTURE_DOCS: Record<string, AnalyzedDocument> = {
  [BENEFITS_DOC.id]: BENEFITS_DOC,
  [DENTAL_FORM_DOC.id]: DENTAL_FORM_DOC,
  [NOTICE_DOC.id]: NOTICE_DOC,
};
