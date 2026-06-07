import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { sanitizeIlike } from "@/lib/sanitize-ilike";
import { createClient } from "@/lib/supabase-server";
import { maybeGenerateSupportAssistAnswer } from "@/lib/support/ai";
import { requireTenant } from "@/lib/tenant";

const assistSchema = z.object({
  subject: z.string().min(3).max(300),
  description: z.string().min(3).max(2000),
});

type AssistRequest = z.infer<typeof assistSchema>;

export const POST = withValidation(assistSchema, async (data: AssistRequest) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const supabase = await createClient();
  const query = sanitizeIlike(`${data.subject} ${data.description}`.trim().slice(0, 120));

  let faqQuery = supabase
    .from("chatbot_faqs")
    .select("question, answer, category, language")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(5);

  if (query) {
    faqQuery = faqQuery.or(`question.ilike.%${query}%,answer.ilike.%${query}%`);
  }

  const { data: faqRows } = await faqQuery;
  const faqContext = (faqRows ?? []).map(
    (row: {
      question: string;
      answer: string;
      category: string | null;
      language: string | null;
    }) => ({
      question: row.question,
      answer: row.answer,
      category: row.category,
      language: row.language,
    }),
  );

  const result = await maybeGenerateSupportAssistAnswer({
    subject: data.subject,
    description: data.description,
    faqContext,
  });

  return apiSuccess({
    ...result,
    matches: faqContext,
  });
});
