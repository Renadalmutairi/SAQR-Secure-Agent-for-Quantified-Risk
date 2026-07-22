import { 
  InvestigationState, 
  RiskLevel, 
  RecommendedAction, 
  Alert 
} from "../types";

export const mockCases: InvestigationState[] = [
  {
    case_id: "SAQR-2026-9041",
    title: "مؤسسة غمام نجد للأجهزة الثمينة (افتراضية) - نمط إيداع مجزأ (Smurfing)",
    status: "new",
    assigned_to: "عبدالرحمن الشمري",
    created_at: "2026-07-10T01:15:00Z",
    pipeline_step: 0,
    comments: [
      "الحساب كان خاملاً لمدة ٦ أشهر قبل هذه التدفقات.",
      "تم التواصل مع العميل هاتفياً، والخط مغلق حالياً."
    ],
    transaction: {
      transaction_id: "TX-98410294",
      account_id: "SA8005000010002930491022", // Alinma Bank Format
      counterparty_id: "إيداعات نقدية متعددة (ATM)",
      amount: 480000,
      currency: "SAR",
      timestamp: "2026-07-10T01:05:00Z",
      channel: "internal_transfer",
      raw_metadata: {
        "اسم الحساب": "مؤسسة غمام نجد للاستيراد والتصدير (افتراضية)",
        "الفرع": "فرع العليا - الرياض",
        "الرمز البريدي": "11564",
        "معرف العميل": "CUST-88301",
        "عدد المودعين": "١٨ مودعاً خلال ٤٨ ساعة",
      }
    },
    dna_fingerprint: {
      entity_id: "SA8005000010002930491022",
      fingerprint_hash: "0x8fa3f8...f42",
      deviation_score: 0.94,
      generated_at: "2026-07-10T01:10:00Z",
      notes: "انحراف سلوكي حاد ومفاجئ. كان متوسط الحركات الشهرية لا يتجاوز ٥,٠٠٠ ريال، وفجأة استقبل الحساب ما مجموعه ٤٨٠,٠٠٠ ريال خلال يومين دون مبرر تجاري واضح."
    },
    route_decision: "continue",
    graph_result: {
      entities: [
        { entity_id: "SA8005000010002930491022", entity_type: "account", label: "مؤسسة غمام نجد (حساب مستهدف - افتراضي)", details: { "البنك": "مصرف الإنماء", "الرصيد الحقيقي": "٤٨٢,١٢٠ ريال", "النوع": "حساب شركة" } },
        { entity_id: "CUST-88301", entity_type: "person", label: "تركي بن ماجد العتيبي (صاحب المنشأة الفرضية)", details: { "الهوية": "١٠٨٢٣٤٩٢٨١", "الحالة": "نشط" } },
        { entity_id: "ATM-RYD-04", entity_type: "device", label: "صراف الإنماء - شارع العليا", details: { "رقم الصراف": "ATM-9042", "المدينة": "الرياض" } },
        { entity_id: "ATM-JED-12", entity_type: "device", label: "صراف الإنماء - طريق الملك", details: { "رقم الصراف": "ATM-1102", "المدينة": "جدة" } },
        { entity_id: "IP-185.220.101.4", entity_type: "ip", label: "IP: 185.220.101.4 (بروتوكول مجهول)", details: { "الدولة": "ألمانيا - VPN", "النوع": "خادم مجهول الهوية" } },
        { entity_id: "ACC-DODGE-01", entity_type: "account", label: "حساب مشتبه به (بنك محلي آخر)", details: { "صاحب الحساب": "مجهول", "الرصيد": "٩٨,٠٠٠ ريال" } },
        { entity_id: "IP-82.164.22.18", entity_type: "ip", label: "IP: 82.164.22.18 (الرياض)", details: { "مزود الخدمة": "STC", "النوع": "اتصال جوال" } },
        { entity_id: "PHONE-55403211", entity_type: "phone", label: "جوال: +96655403211", details: { "المالك": "مؤسسة غمام نجد", "الشبكة": "موبايلي" } }
      ],
      relationships: [
        { source_id: "CUST-88301", target_id: "SA8005000010002930491022", relationship_type: "owns", weight: 1.0 },
        { source_id: "ATM-RYD-04", target_id: "SA8005000010002930491022", relationship_type: "transacted_with", weight: 0.8 },
        { source_id: "ATM-JED-12", target_id: "SA8005000010002930491022", relationship_type: "transacted_with", weight: 0.8 },
        { source_id: "IP-185.220.101.4", target_id: "SA8005000010002930491022", relationship_type: "uses_ip", weight: 0.9 },
        { source_id: "SA8005000010002930491022", target_id: "ACC-DODGE-01", relationship_type: "transacted_with", weight: 0.6 },
        { source_id: "IP-82.164.22.18", target_id: "CUST-88301", relationship_type: "uses_ip", weight: 0.7 },
        { source_id: "PHONE-55403211", target_id: "CUST-88301", relationship_type: "uses_phone", weight: 1.0 }
      ],
      suspicious_node_ids: ["SA8005000010002930491022", "IP-185.220.101.4", "ACC-DODGE-01"],
      notes: "الحساب متصل بعنوان IP أجنبي مشبوه (VPN) مرتبط بنقاط بيع مجهولة في نفس توقيت إيداعات الصراف اليدوية بجدة والرياض (أقل من ساعة فرق زمني)، مما يعني استحالة أن يكون الشخص نفسه."
    },
    aml_result: {
      findings: [
        { typology: "smurfing", matched: true, confidence: 96, evidence: { "الوصف": "تلقي دفعات نقدية متعددة دون الحد الإلزامي للتبليغ (٥٠ ألف ريال) متقاربة زمنياً بالتعاون مع أطراف متعددة.", "التفاصيل": "١٨ إيداعاً بقيم تتراوح بين ٢٠,٠٠٠ و٢٩,٠٠0 ريال." } },
        { typology: "structuring", matched: true, confidence: 91, evidence: { "الوصف": "تجزئة المبالغ لعدم تجاوز سقف الإقرار النقدي الصادر من البنك المركزي السعودي SAMA.", "التفاصيل": "المجموع المتراكم ٤٨٠,٠٠٠ ريال سعودي مقسمة عمداً." } },
        { typology: "circular_transactions", matched: false, confidence: 15, evidence: {} }
      ],
      notes: "تطابق كامل لنمط غسيل الأموال بالتجزئة (Smurfing/Structuring). السلوك يستوفي مؤشرات الاشتباه التنظيمية الصادرة عن هيئة مكافحة غسيل الأموال."
    },
    trust_decision: {
      risk_score: 94,
      confidence: 95,
      risk_level: RiskLevel.CRITICAL,
      recommended_action: RecommendedAction.FREEZE_TRANSACTION,
      reasoning: "توصي طبقة حماية صقر الذكية بتجميد حساب المنشأة المؤقت فوراً والتحفظ على المبالغ المودعة؛ وذلك نظراً لتطابق المؤشرات مع عملية هيكلة غسيل أموال مكثفة (Smurfing) بالتزامن مع استخدام بروتوكولات اتصال مشبوهة لتمرير الحركات محلياً ودولياً.",
      contributing_factors: [
        "إيداعات نقدية من أجهزة صراف متعددة ومتباعدة جغرافياً في الرياض وجدة بفرق زمني لا يسمح بالسفر.",
        "عنوان IP مجهول الهوية مرتبط بنطاق تصفح محظور.",
        "الحساب خامل تجارياً وارتفع نشاطه بنسبة ٩,٦٠٠٪ بشكل مفاجئ."
      ]
    },
    audit_log: [
      { step_name: "تأهيل السلوك المالي", agent: "DNA Agent", input_summary: { "حساب المنشأة": "SA8005000010002930491022" }, output_summary: { "مؤشر الانحراف": "0.94" }, started_at: "2026-07-10T01:10:00Z", finished_at: "2026-07-10T01:10:01.5Z", duration_ms: 1500 },
      { step_name: "توجيه وسير العمل", agent: "Supervisor Agent", input_summary: { "مستوى الخطورة الأولي": "حرجة" }, output_summary: { "المسار": "مسار فحص عاجل وتحقيق مكثف" }, started_at: "2026-07-10T01:10:01.5Z", finished_at: "2026-07-10T01:10:02Z", duration_ms: 500 },
      { step_name: "تحليل العلاقات الشبكية", agent: "Graph Agent", input_summary: { "أجهزة الصراف": "متعددة" }, output_summary: { "الربط": "الرياض وجدة عبر VPN ألماني" }, started_at: "2026-07-10T01:10:02Z", finished_at: "2026-07-10T01:10:04Z", duration_ms: 2000 },
      { step_name: "مطابقة مكافحة غسيل الأموال", agent: "AML Agent", input_summary: { "الأنماط": "هيكلة وتجزئة" }, output_summary: { "ثقة المطابقة": "٩٦٪" }, started_at: "2026-07-10T01:10:04Z", finished_at: "2026-07-10T01:10:05.2Z", duration_ms: 1200 },
      { step_name: "اتخاذ القرار والتقييم", agent: "Trust Agent", input_summary: { "المخرجات": "متكاملة" }, output_summary: { "الإجراء الموصى به": "تجميد الحساب والتحفظ" }, started_at: "2026-07-10T01:10:05.2Z", finished_at: "2026-07-10T01:10:06.5Z", duration_ms: 1300 }
    ],
    report_draft: {
      summary: "مسودة بلاغ تجميد الحساب SAQR-2026-9041",
      notes: "تم كشف عملية غسيل أموال مكثفة من خلال نمط إيداع مجزأ (Smurfing). تم اتخاذ الإجراءات التحفظية اللازمة وتجميد الحساب والرفع للجهات المختصة.",
      signee: "المحقق المالي: عبدالرحمن الشمري",
      department: "إدارة الالتزام والتحقيقات المالية",
      is_signed: false
    }
  },
  {
    case_id: "SAQR-2026-7812",
    title: "سليمان بن محمد الفهيد - اشتباه استيلاء على حساب (Account Takeover)",
    status: "new",
    assigned_to: "سارة القحطاني",
    created_at: "2026-07-10T02:00:00Z",
    pipeline_step: 0,
    comments: [
      "تم تفعيل تطبيق مصرف الإنماء على هاتف آيفون جديد من سويسرا.",
      "الحساب يمتلك رصيداً كبيراً غير متحرك منذ سنتين."
    ],
    transaction: {
      transaction_id: "TX-10492813",
      account_id: "SA8005000020084712039402",
      counterparty_id: "مؤسسة زوريخ للخدمات المالية (خارجي)",
      amount: 1250000,
      currency: "SAR",
      timestamp: "2026-07-10T01:55:00Z",
      channel: "wire",
      raw_metadata: {
        "اسم الحساب": "سليمان بن محمد الفهيد",
        "الفرع": "فرع الحمراء - جدة",
        "تاريخ ركود الحساب": "٧٤٠ يوماً",
        "تغيير الجهاز": "قبل الحوالة بـ ١٢ دقيقة",
        "موقع تسجيل الدخول": "زيورخ، سويسرا"
      }
    },
    dna_fingerprint: {
      entity_id: "SA8005000020084712039402",
      fingerprint_hash: "0x3e10ab...cc4",
      deviation_score: 0.89,
      generated_at: "2026-07-10T02:02:00Z",
      notes: "تغيير غير اعتيادي مطلقاً. العميل مسجل تاريخياً بعملياته الحصرية داخل مدينة جدة باستخدام بطاقات صراف مادية ومشتريات بقالة وصيدليات."
    },
    route_decision: "continue",
    graph_result: {
      entities: [
        { entity_id: "SA8005000020084712039402", entity_type: "account", label: "حساب سليمان الفهيد (الهدف)", details: { "النوع": "حساب أفراد", "الرصيد": "٢,٤٥٠,٠٠٠ ريال" } },
        { entity_id: "DEV-IPHONE15", entity_type: "device", label: "iPhone 15 Pro (مسجل حديثاً)", details: { "الرقم التسلسلي": "IMEI-84920", "توقيت التسجيل": "١٢ دقيقة قبل الحوالة" } },
        { entity_id: "IP-45.12.98.2", entity_type: "ip", label: "IP: 45.12.98.2 (زيورخ)", details: { "شبكة الاتصال": "Interoute VPN", "الموقع": "سويسرا" } },
        { entity_id: "SWISS-FIN-01", entity_type: "bank", label: "مؤسسة زوريخ للخدمات المالية", details: { "نوع الطرف المستفيد": "ملاذ مالي آمن", "الدولة": "سويسرا" } },
        { entity_id: "OLD-DEV-GALAXY", entity_type: "device", label: "Samsung S22 (الجهاز القديم المعتاد)", details: { "الحالة": "غير متصل منذ شهرين" } }
      ],
      relationships: [
        { source_id: "SA8005000020084712039402", target_id: "DEV-IPHONE15", relationship_type: "shares_device", weight: 1.0 },
        { source_id: "DEV-IPHONE15", target_id: "IP-45.12.98.2", relationship_type: "uses_ip", weight: 0.95 },
        { source_id: "SA8005000020084712039402", target_id: "SWISS-FIN-01", relationship_type: "transacted_with", weight: 0.8 },
        { source_id: "SA8005000020084712039402", target_id: "OLD-DEV-GALAXY", relationship_type: "owns", weight: 0.5 }
      ],
      suspicious_node_ids: ["DEV-IPHONE15", "IP-45.12.98.2", "SWISS-FIN-01"],
      notes: "تعديل بيانات الحساب الحساسة (تسجيل جهاز جديد في غضون دقائق من طلب حوالة خارجية ضخمة) عبر موقع جغرافي مختلف كلياً يؤكد الاختراق الفني العالي للخدمات المصرفية الرقمية."
    },
    aml_result: {
      findings: [
        { typology: "high_velocity", matched: true, confidence: 88, evidence: { "سرعة التنفيذ": "تغيير بيانات الأمان وتمرير حوالة بنصف ثوانٍ" } },
        { typology: "layering", matched: true, confidence: 79, evidence: { "النوع": "محاولة تهريب أموال خارجية مباشرة إلى بنك مجهول التفاصيل" } }
      ],
      notes: "محاولة تهريب سريعة جداً للأموال الراكدة قبل اكتشاف الضحية للسرقة."
    },
    trust_decision: {
      risk_score: 87,
      confidence: 91,
      risk_level: RiskLevel.HIGH,
      recommended_action: RecommendedAction.ESCALATE_TO_REGULATOR,
      reasoning: "اشتباه استيلاء كامل على حساب خامل (Account Takeover). تسجيل جهاز أجنبي وطلب حوالة دولية بنسبة انحراف مالي قصوى يتطلب تعليق حساب العميل والاتصال الفوري للتأكيد أو الإبلاغ الفوري للجهات التنظيمية بموجب معايير مكافحة الاحتيال المالي.",
      contributing_factors: [
        "تسجيل جهاز أمني جديد من عنوان IP مدرج في قوائم المراقبة الدولية لعناوين الـ VPN المشبوهة.",
        "قيمة الحوالة تماثل ٥٠٪ من الرصيد المتراكم غير المتحرك منذ سنتين.",
        "عدم تطابق السلوك التاريخي للمدير الفعلي للحساب ماليًا وجغرافيًا."
      ]
    },
    audit_log: [
      { step_name: "تأهيل السلوك المالي", agent: "DNA Agent", input_summary: { "حساب العميل": "SA8005000020084712039402" }, output_summary: { "مؤشر الانحراف": "0.89" }, started_at: "2026-07-10T02:02:00Z", finished_at: "2026-07-10T02:02:01.5Z", duration_ms: 1500 },
      { step_name: "توجيه وسير العمل", agent: "Supervisor Agent", input_summary: { "مستوى الخطورة الأولي": "مرتفع" }, output_summary: { "المسار": "مسار فحص عاجل (Escalated Workflow)" }, started_at: "2026-07-10T02:02:01.5Z", finished_at: "2026-07-10T02:02:02Z", duration_ms: 500 },
      { step_name: "تحليل العلاقات الشبكية", agent: "Graph Agent", input_summary: { "الجهاز المشبوه": "جديد" }, output_summary: { "الرابط الجغرافي": "سويسرا، خوادم مجهولة" }, started_at: "2026-07-10T02:02:02Z", finished_at: "2026-07-10T02:02:04Z", duration_ms: 2000 },
      { step_name: "مطابقة مكافحة غسيل الأموال", agent: "AML Agent", input_summary: { "نمط تهريب مالي": "تحت الدراسة" }, output_summary: { "احتمالية الاستيلاء": "٨٨٪" }, started_at: "2026-07-10T02:02:04Z", finished_at: "2026-07-10T02:02:05.2Z", duration_ms: 1200 },
      { step_name: "اتخاذ القرار والتقييم", agent: "Trust Agent", input_summary: { "المخرجات": "متكاملة" }, output_summary: { "الإجراء الموصى به": "الرفع للهيئة الرقابية وتعليق مؤقت" }, started_at: "2026-07-10T02:02:05.2Z", finished_at: "2026-07-10T02:02:06.5Z", duration_ms: 1300 }
    ],
    report_draft: {
      summary: "مسودة بلاغ تجميد احتيالي للحساب SAQR-2026-7812",
      notes: "تم كشف محاولة تصيد واختراق مالي للعميل سليمان الفهيد بعد تسجيل دخول مريب من سويسرا وتنفيذ حوالة بمبلغ ١,٢٥ مليون ريال لمؤسسة مالية مشبوهة. تم اتخاذ التدابير الحمائية وتعليق الحساب والرفع العاجل لأمن مصرف الإنماء وللبنك المركزي السعودي.",
      signee: "المحقق المالي: سارة القحطاني",
      department: "مركز العمليات الأمنية المشتركة - الاستخبارات المالية بمصرف الإنماء",
      is_signed: false
    }
  },
  {
    case_id: "SAQR-2026-4402",
    title: "شركة الكثبان الممتدة للمقاولات - هيكلة ودائع متكررة (Structuring)",
    status: "new",
    assigned_to: "فهد الدوسري",
    created_at: "2026-07-10T03:00:00Z",
    pipeline_step: 0,
    comments: [
      "عمليات إيداع نقدية بقيم متماثلة جداً (٤٩,٠٠٠ ريال) بالقرب من الحد القانوني.",
      "تمت العمليات في ٥ فروع مختلفة بالمنطقة الشرقية بفارق زمني بسيط."
    ],
    transaction: {
      transaction_id: "TX-40291032",
      account_id: "SA8005000030048102930219",
      counterparty_id: "إيداع نقدي فرعي - فرع الدمام",
      amount: 49000,
      currency: "SAR",
      timestamp: "2026-07-10T02:45:00Z",
      channel: "internal_transfer",
      raw_metadata: {
        "اسم الحساب": "شركة الكثبان الممتدة للمقاولات العامة",
        "الفرع الرئيسي": "فرع الخبر",
        "مجموع الإيداعات الأخيرة": "٢٤٥,٠٠٠ ريال سعودي",
        "قنوات الإيداع": "أجهزة الصراف التفاعلية (ITM)",
        "العدد الإجمالي للحركات": "٥ إيداعات بقيمة ٤٩ ألف ريال"
      }
    },
    dna_fingerprint: {
      entity_id: "SA8005000030048102930219",
      fingerprint_hash: "0xfa10cc...102",
      deviation_score: 0.62,
      generated_at: "2026-07-10T03:05:00Z",
      notes: "انحراف معتدل إلى مرتفع. كشركة مقاولات، من المعتاد استقبال شيكات وحوالات سريعة من شركات كبرى، ولكن الإيداعات النقدية الفيزيائية الكبيرة والمتكررة بحدود متطابقة جداً ليست من ضمن البصمة السلوكية التاريخية للمؤسسة."
    },
    route_decision: "continue",
    graph_result: {
      entities: [
        { entity_id: "SA8005000030048102930219", entity_type: "account", label: "شركة الكثبان الممتدة (الحساب)", details: { "النوع": "حساب تجاري نشط", "الرصيد": "٧١٠,٠٠٠ ريال" } },
        { entity_id: "ITM-DAMMAM-1", entity_type: "device", label: "صراف فرع الشاطئ - الدمام", details: { "الموقع": "الدمام" } },
        { entity_id: "ITM-KHOBAR-3", entity_type: "device", label: "صراف طريق الأمير نايف - الخبر", details: { "الموقع": "الخبر" } },
        { entity_id: "ITM-QATIF-2", entity_type: "device", label: "صراف فرع القطيف", details: { "الموقع": "القطيف" } },
        { entity_id: "PHONE-501192831", entity_type: "phone", label: "جوال مفوض المؤسسة: +966501192831", details: { "الاسم": "صالح الدوسري" } }
      ],
      relationships: [
        { source_id: "ITM-DAMMAM-1", target_id: "SA8005000030048102930219", relationship_type: "transacted_with", weight: 0.7 },
        { source_id: "ITM-KHOBAR-3", target_id: "SA8005000030048102930219", relationship_type: "transacted_with", weight: 0.7 },
        { source_id: "ITM-QATIF-2", target_id: "SA8005000030048102930219", relationship_type: "transacted_with", weight: 0.7 },
        { source_id: "PHONE-501192831", target_id: "SA8005000030048102930219", relationship_type: "owns", weight: 1.0 }
      ],
      suspicious_node_ids: ["SA8005000030048102930219", "ITM-DAMMAM-1", "ITM-KHOBAR-3"],
      notes: "استخدام أجهزة صراف بعيدة جغرافياً لإيداع مبالغ نقدية متطابقة في أوقات متقاربة جداً يشير إلى وجود شبكة من المودعين (Smurfs) يسعون لإدخال النقد السائل للنظام البنكي خفية."
    },
    aml_result: {
      findings: [
        { typology: "structuring", matched: true, confidence: 94, evidence: { "وصف الهيكلة": "تقسيم الودائع لتفادي حاجز الـ ٥٠,٠٠٠ ريال لتجنب توثيق الهوية ومصدر الأموال." } },
        { typology: "smurfing", matched: true, confidence: 75, evidence: { "عدد المودعين المرجح": "شخصين على الأقل يتنقلان بين الفروع" } }
      ],
      notes: "محاولات واضحة للالتفاف حول حواجز الامتثال التنظيمي للبنك المركزي."
    },
    trust_decision: {
      risk_score: 62,
      confidence: 85,
      risk_level: RiskLevel.MEDIUM,
      recommended_action: RecommendedAction.FLAG_FOR_REVIEW,
      reasoning: "توصي منصة صقر بوضع الحساب تحت المراقبة المكثفة (Flag for Review) مع طلب مستندات إثبات عقود المقاولات ومصادر المبالغ النقدية فوراً من مفوض المنشأة، دون الحاجة للتجميد الكامل في هذه المرحلة لتفادي تعطيل حركة العمل المعتادة.",
      contributing_factors: [
        "إيداعات نقدية متتالية بمبالغ ٤٩,٠٠٠ ريال (أقل بألف ريال فقط من سقف التبليغ الإلزامي).",
        "توزع جغرافي غير اعتيادي للإيداع خلال ساعات قليلة.",
        "القطاع النشط (المقاولات) من القطاعات عالية المخاطر في غسيل الأموال بالمملكة."
      ]
    },
    audit_log: [
      { step_name: "تأهيل السلوك المالي", agent: "DNA Agent", input_summary: { "حساب المنشأة": "SA8005000030048102930219" }, output_summary: { "مؤشر الانحراف": "0.62" }, started_at: "2026-07-10T03:05:00Z", finished_at: "2026-07-10T03:05:01.2Z", duration_ms: 1200 },
      { step_name: "توجيه وسير العمل", agent: "Supervisor Agent", input_summary: { "مؤشر الانحراف": "0.62" }, output_summary: { "التوجيه": "متابعة الفحص القياسي" }, started_at: "2026-07-10T03:05:01.2Z", finished_at: "2026-07-10T03:05:01.8Z", duration_ms: 600 },
      { step_name: "تحليل العلاقات الشبكية", agent: "Graph Agent", input_summary: { "مواقع أجهزة الصراف": "نشط" }, output_summary: { "روابط الصراف المتعددة": "متطابقة ومتقاطعة" }, started_at: "2026-07-10T03:05:01.8Z", finished_at: "2026-07-10T03:05:03Z", duration_ms: 1200 },
      { step_name: "مطابقة مكافحة غسيل الأموال", agent: "AML Agent", input_summary: { "الأنماط المسجلة": "هيكلة الودائع" }, output_summary: { "ثقة المطابقة": "٩٤٪" }, started_at: "2026-07-10T03:05:03Z", finished_at: "2026-07-10T03:05:04.5Z", duration_ms: 1500 },
      { step_name: "اتخاذ القرار والتقييم", agent: "Trust Agent", input_summary: { "المخرجات": "شبه متكاملة" }, output_summary: { "القرار": "طلب وثائق إثبات ومراجعة لاحقة" }, started_at: "2026-07-10T03:05:04.5Z", finished_at: "2026-07-10T03:05:05.5Z", duration_ms: 1000 }
    ],
    report_draft: {
      summary: "تقرير فحص الامتثال للحساب SAQR-2026-4402",
      notes: "نوصي بالتخاطب مع العميل بشكل رسمي لإثبات مصدر النقد وتوضيح أسباب إيداعه بطريقة مجزأة عبر صرافات مختلفة. سيتم تعليق اتخاذ أي إجراء تجميدي بانتظار رد الامتثال.",
      signee: "المحقق المالي: فهد الدوسري",
      department: "وحدة مكافحة غسل الأموال - مصرف الإنماء",
      is_signed: false
    }
  },
  {
    case_id: "SAQR-2026-1190",
    title: "شركة مروج الجزيرة للأغذية - حوالة رواتب مؤسسات اعتيادية (Normal)",
    status: "archived",
    assigned_to: "فهد الدوسري",
    created_at: "2026-07-10T04:00:00Z",
    pipeline_step: 0,
    comments: [
      "تم الفحص تلقائياً وتصنيف العملية كنشاط آمن بالكامل.",
      "الحساب معتمد وموثق كمنشأة عملاقة ذات مخاطر منخفضة."
    ],
    transaction: {
      transaction_id: "TX-11904213",
      account_id: "SA8005000045001122003344",
      counterparty_id: "مصرف الإنماء - نظام الرواتب الموحد (WPS)",
      amount: 8450000,
      currency: "SAR",
      timestamp: "2026-07-10T03:50:00Z",
      channel: "wire",
      raw_metadata: {
        "اسم الحساب": "شركة مروج الجزيرة المساهمة للأغذية",
        "النوع": "حوالة رواتب إلكترونية نظام حماية الأجور",
        "عدد الموظفين المستفيدين": "١,٤٥٠ موظف",
        "الموقع": "الرياض - الإدارة العامة"
      }
    },
    dna_fingerprint: {
      entity_id: "SA8005000045001122003344",
      fingerprint_hash: "0x1102bb...55a",
      deviation_score: 0.02,
      generated_at: "2026-07-10T04:02:00Z",
      notes: "تطابق تام ومثالي مع البصمة السلوكية التاريخية. تتكرر العملية بدقة متناهية في يوم ٢٥ من كل شهر ميلادي وبمبالغ متقاربة جداً."
    },
    route_decision: "fast_track",
    graph_result: {
      entities: [
        { entity_id: "SA8005000045001122003344", entity_type: "account", label: "شركة مروج الجزيرة (حساب رواتب الرئيسي)", details: { "البنك": "مصرف الإنماء", "الرصيد": "٥٥,٤٠٠,٠٠٠ ريال" } },
        { entity_id: "WPS-MINISTRY", entity_type: "bank", label: "نظام حماية الأجور (وزارة الموارد البشرية)", details: { "التكامل": "رسمي ومفعل" } },
        { entity_id: "CUST-ALMARAI", entity_type: "company", label: "شركة مروج الجزيرة المساهمة", details: { "السجل التجاري": "١٠١٠٠١٤٥٠٠" } }
      ],
      relationships: [
        { source_id: "CUST-ALMARAI", target_id: "SA8005000045001122003344", relationship_type: "owns", weight: 1.0 },
        { source_id: "SA8005000045001122003344", target_id: "WPS-MINISTRY", relationship_type: "transacted_with", weight: 1.0 }
      ],
      suspicious_node_ids: [],
      notes: "الشبكة المالية متوافقة بالكامل مع القنوات الرسمية لوزارة الموارد البشرية والبنك المركزي السعودي. الحسابات الفرعية المستفيدة موثقة الهوية ورواتب معتمدة."
    },
    aml_result: {
      findings: [
        { typology: "structuring", matched: false, confidence: 1, evidence: {} },
        { typology: "smurfing", matched: false, confidence: 1, evidence: {} }
      ],
      notes: "لا تطابق لأي من مؤشرات ومصفوفات الاشتباه الجنائية."
    },
    trust_decision: {
      risk_score: 4,
      confidence: 99,
      risk_level: RiskLevel.LOW,
      recommended_action: RecommendedAction.NO_ACTION,
      reasoning: "سلوك آمن وموثوق وموثق تاريخياً بشكل دوري متناسق مع بصمة نظام حماية الأجور الحكومية (WPS). توصي طبقة حماية صقر بالاعتماد التلقائي دون تدخل المحقق المالي.",
      contributing_factors: [
        "سجل تاريخي نظيف وخالٍ تماماً من أي بلاغات اشتباه أو تجميد.",
        "التكامل التام مع المنصات الرسمية للدولة.",
        "انعدام الانحراف المالي والسلوكي (Deviation = 2%)."
      ]
    },
    audit_log: [
      { step_name: "تأهيل السلوك المالي", agent: "DNA Agent", input_summary: { "حساب المنشأة": "SA8005000045001122003344" }, output_summary: { "مؤشر الانحراف": "0.02" }, started_at: "2026-07-10T04:02:00Z", finished_at: "2026-07-10T04:02:00.8Z", duration_ms: 800 },
      { step_name: "توجيه وسير العمل", agent: "Supervisor Agent", input_summary: { "انحراف منخفض جداً": "0.02" }, output_summary: { "التوجيه": "تخطي سريع وتفعيل المسار التلقائي (Fast-Track Archive)" }, started_at: "2026-07-10T04:02:00.8Z", finished_at: "2026-07-10T04:02:01.1Z", duration_ms: 300 }
    ],
    report_draft: {
      summary: "تقرير التدقيق التلقائي للحساب الآمن SAQR-2026-1190",
      notes: "تمت أرشفة القضية تلقائياً بنجاح بواسطة محرك صقر الذكي دون الحاجة لتدخل بشري نظراً للموثوقية الكاملة للعملية الموثقة.",
      signee: "النظام التلقائي لصقر",
      department: "محرك الأرشفة الذكي - مصرف الإنماء",
      is_signed: true,
      signed_at: "2026-07-10T04:02:01Z"
    }
  }
];

export const mockAlerts: Alert[] = [
  {
    id: "AL-1",
    case_id: "SAQR-2026-9041",
    type: "high_risk",
    message: "قضية خطرة جديدة: اشتباه نمط غسيل أموال (Smurfing) على حساب مؤسسة السيف",
    timestamp: "2026-07-10T04:15:00Z",
    unread: true,
    severity: "critical"
  },
  {
    id: "AL-2",
    case_id: "SAQR-2026-7812",
    type: "escalation",
    message: "اشتباه استيلاء (Account Takeover) في جدة - طلب حوالة لزيورخ بقيمة ١.٢٥ مليون ريال",
    timestamp: "2026-07-10T04:22:00Z",
    unread: true,
    severity: "critical"
  },
  {
    id: "AL-3",
    case_id: "SAQR-2026-4402",
    type: "new_case",
    message: "قضية قيد التحقيق: تكرار إيداعات نقدية متطابقة في الخبر والدمام (مؤسسة الرمال)",
    timestamp: "2026-07-10T04:25:00Z",
    unread: false,
    severity: "warning"
  },
  {
    id: "AL-4",
    case_id: "SAQR-2026-9041",
    type: "deadline",
    message: "اقتراب موعد الامتثال القانوني: متبقي ساعتان للتبليغ البنكي الإلزامي لـ SAMA حول قضية مجموعة السيف",
    timestamp: "2026-07-10T06:15:00Z",
    unread: true,
    severity: "warning"
  }
];
