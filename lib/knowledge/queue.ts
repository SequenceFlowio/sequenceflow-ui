import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function enqueueKnowledgeIngest(documentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: activeJob, error: activeJobError } = await supabase
    .from("knowledge_ingest_jobs")
    .select("id, status")
    .eq("document_id", documentId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeJobError) throw new Error(`Could not inspect the knowledge queue: ${activeJobError.message}`);
  if (activeJob) return { jobId: activeJob.id as string, alreadyQueued: true };

  const { data: job, error: jobError } = await supabase
    .from("knowledge_ingest_jobs")
    .insert({ document_id: documentId, status: "pending" })
    .select("id")
    .single();

  if (jobError || !job) throw new Error(`Could not queue the document: ${jobError?.message ?? "Unknown queue error"}`);

  const { error: documentError } = await supabase
    .from("knowledge_documents")
    .update({ status: "pending", error: null, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  if (documentError) {
    await supabase.from("knowledge_ingest_jobs").delete().eq("id", job.id);
    throw new Error(`Could not mark the document as pending: ${documentError.message}`);
  }

  return { jobId: job.id as string, alreadyQueued: false };
}
