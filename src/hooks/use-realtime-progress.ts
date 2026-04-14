"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ScrapingJobProgress {
  id: string;
  tool_id: string;
  tool_name: string;
  status: string;
  estimated_results: number | null;
  actual_results: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  quality_score: string | null;
  error_message: string | null;
}

export function useRealtimeProgress(projectId: string) {
  const [jobs, setJobs] = useState<ScrapingJobProgress[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>("draft");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchInitial() {
      const { data: jobsData } = await supabase
        .from("scraping_jobs")
        .select("id, tool_id, tool_name, status, estimated_results, actual_results, estimated_cost, actual_cost, quality_score, error_message")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: projectData } = await supabase
        .from("research_projects")
        .select("status, total_actual_cost")
        .eq("id", projectId)
        .single();

      if (jobsData) setJobs(jobsData);
      if (projectData) setProjectStatus(projectData.status);
      setLoading(false);
    }

    fetchInitial();

    const jobsChannel = supabase
      .channel(`jobs-${projectId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "scraping_jobs",
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        const updated = payload.new as ScrapingJobProgress;
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
      })
      .subscribe();

    const projectChannel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "research_projects",
        filter: `id=eq.${projectId}`,
      }, (payload) => {
        setProjectStatus((payload.new as { status: string }).status);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(projectChannel);
    };
  }, [projectId]);

  return { jobs, projectStatus, loading };
}
