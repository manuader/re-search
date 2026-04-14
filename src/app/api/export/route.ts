import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flattenRawData } from "@/lib/export/flatten";
import { generateExcel, generateCsv } from "@/lib/export/excel";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId, format } = body as {
    projectId?: string;
    format?: "xlsx" | "csv";
  };

  if (!projectId || !format || !["xlsx", "csv"].includes(format)) {
    return NextResponse.json(
      { error: "Missing or invalid projectId / format" },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const { data: project, error: projectError } = await supabase
    .from("research_projects")
    .select("id, title")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch all raw_data for the project
  const { data: rawData, error: dataError } = await supabase
    .from("raw_data")
    .select("id, source, content, ai_fields, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (dataError) {
    return NextResponse.json({ error: dataError.message }, { status: 500 });
  }

  if (!rawData || rawData.length === 0) {
    return NextResponse.json({ error: "No data to export" }, { status: 400 });
  }

  // Flatten the data
  const { columns, rows } = flattenRawData(rawData);

  // Generate file
  let fileBuffer: Buffer;
  let contentType: string;

  if (format === "xlsx") {
    fileBuffer = await generateExcel(columns, rows, project.title ?? "Export");
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    const csv = generateCsv(columns, rows);
    fileBuffer = Buffer.from(csv, "utf-8");
    contentType = "text/csv";
  }

  // Upload to Supabase Storage
  const path = `${user.id}/${projectId}/export-${Date.now()}.${format}`;

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(path, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create signed URL valid for 24 hours
  const { data: signedUrlData, error: signedUrlError } =
    await supabase.storage.from("exports").createSignedUrl(path, 86400);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: signedUrlError?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  const filename = `export-${projectId}.${format}`;

  return NextResponse.json({ url: signedUrlData.signedUrl, filename });
}
