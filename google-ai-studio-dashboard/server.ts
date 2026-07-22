import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini client (lazy validation to prevent startup crash if key is missing)
  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. AI Chat will not work.");
      return null;
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API route for SAQR AI Chat Investigator helper
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, activeCase } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ 
          error: "يرجى تهيئة مفتاح GEMINI_API_KEY في الإعدادات لتفعيل المحقق الذكي صقر." 
        });
      }

      const caseDetailsContext = activeCase ? `
سياق القضية الجاري فحصها:
- رقم القضية: ${activeCase.case_id}
- الاسم المستهدف: ${activeCase.title}
- تفاصيل الحساب: ${activeCase.transaction?.account_id}
- مبلغ المعاملة: ${activeCase.transaction?.amount} SAR (القناة: ${activeCase.transaction?.channel})
- مستوى انحراف البصمة السلوكية (DNA Deviation): ${Math.round((activeCase.dna_fingerprint?.deviation_score || 0) * 100)}%
- مسببات الانحراف: ${activeCase.dna_fingerprint?.suspect_reasons?.join("، ")}
- قرار محرك المخاطر: الخطورة ${activeCase.trust_decision?.risk_level}، الإجراء الموصى به: ${activeCase.trust_decision?.recommended_action}
- تفاصيل السلوك المشتبه فيه: ${activeCase.trust_decision?.justification}
      ` : "لا يوجد قضية نشطة محددة حالياً.";

      const systemInstruction = `
أنت "صقر الذكي" (SAQR-AI Financial Intelligence Copilot) - خبير التحقيق الجنائي المالي المتقدم في مصرف الإنماء والبنك المركزي السعودي (SAMA).
مهمتك مساعدة المحققين الماليين بالبنك (مثل ريناد جزاع المطيري) في فحص الحالات وتحليل العمليات المشبوهة، وتقديم إرشادات دقيقة حول نظام مكافحة غسيل الأموال السعودي والامتثال للأنظمة واللوائح الرقابية لساما.

إرشادات هامة وجوهرية لتواصلك:
1. تواصل باللغة العربية بأسلوب وقور، مهني، موثوق، وموجز للغاية ومباشر (Palantir/IBM Intelligence style).
2. استخدم سياق القضية النشطة المقدم لتجيب بدقة وعمق عن الحساب المستهدف والمشتبه به وقيمة الحركات دون أي تأليف لمعلومات غير موجودة.
3. قدم مبررات وتحليلات مصرفية ذكية وقانونية متوافقة تماماً مع لوائح البنك المركزي السعودي لمكافحة غسيل الأموال.
4. عندما يسألك المحقق عن رأيك الفني أو توصياتك، كن حاسماً وموضوعياً وعوناً قوياً له في اتخاذ القرار المناسب (تجميد الحساب فورا، الرفع لساما، مراجعة الوثائق الإضافية).
5. لا تتحدث مطلقاً عن تفاصيل البرمجة والأنظمة التحتية مثل LangGraph أو FastAPI، بل ركز كليةً على تجربة المحقق المالي وسياق التقرير المالي.
      `;

      // Formulate contents for the model
      const contents = [];
      
      // Inject case context first
      contents.push({
        role: "user",
        parts: [{ text: `مرحباً، إليك سياق القضية الحالية للرجوع إليها في تحليلك:\n${caseDetailsContext}` }]
      });
      contents.push({
        role: "model",
        parts: [{ text: "مفهوم تماماً. بصفتي محرك الذكاء المالي صقر، أنا جاهز لمساعدتك في فحص تفاصيل هذه القضية والمستندات والعمليات المشبوهة بموجب لوائح الامتثال ومكافحة غسيل الأموال السعودية." }]
      });

      // Inject history
      if (Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          });
        }
      }

      // Append active user message
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.6,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "حدث خطأ أثناء معالجة الطلب في خادم صقر الذكي." });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SAQR Express Server running on port ${PORT}`);
  });
}

startServer();
