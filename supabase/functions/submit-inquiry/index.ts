import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Server is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const payload = normalizePayload(body);
  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  if (payload.company) {
    return json({ ok: true }, 200);
  }

  const elapsedMs =
    new Date(payload.submitted_at).getTime() - new Date(payload.started_at).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 2500) {
    return json({ error: "Please take a moment before submitting the form." }, 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";
  const ipHash = await sha256(ip);

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateLimitError } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", fifteenMinutesAgo);

  if (rateLimitError) {
    return json({ error: "Could not validate your request right now." }, 500);
  }

  if ((recentCount ?? 0) >= 3) {
    return json({ error: "Too many recent inquiries from this connection. Please try again later." }, 429);
  }

  const record = {
    name: payload.name,
    email: payload.email,
    support_type: payload.support_type,
    rhythm: payload.rhythm,
    client_profile: payload.client_profile,
    preferred_contact: payload.preferred_contact,
    details: payload.details,
    source: "website",
    status: "new",
    ip_hash: ipHash,
    user_agent: userAgent,
    page_url: payload.page_url,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("inquiries")
    .insert(record)
    .select("id, created_at, name, email, support_type, rhythm, client_profile, preferred_contact, details")
    .single();

  if (insertError || !inserted) {
    return json({ error: "Could not save your inquiry right now." }, 500);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const notifyToEmail = Deno.env.get("NOTIFY_TO_EMAIL") ?? "";
  const notifyFromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "";

  if (resendApiKey && notifyToEmail && notifyFromEmail) {
    await sendNotification({
      resendApiKey,
      notifyToEmail,
      notifyFromEmail,
      inquiry: inserted,
    });
  }

  return json({ ok: true }, 200);
});

function normalizePayload(body: Record<string, string>) {
  return {
    name: (body.name ?? "").trim(),
    email: (body.email ?? "").trim().toLowerCase(),
    support_type: (body.support_type ?? "").trim(),
    rhythm: (body.rhythm ?? "").trim(),
    client_profile: (body.client_profile ?? "").trim(),
    preferred_contact: (body.preferred_contact ?? "").trim(),
    details: (body.details ?? "").trim(),
    company: (body.company ?? "").trim(),
    started_at: (body.started_at ?? "").trim(),
    submitted_at: (body.submitted_at ?? "").trim(),
    page_url: (body.page_url ?? "").trim(),
  };
}

function validatePayload(payload: ReturnType<typeof normalizePayload>) {
  if (!payload.name || payload.name.length > 120) return "Please enter your name.";
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Please enter a valid email address.";
  }
  if (!payload.support_type) return "Please select a support type.";
  if (!payload.rhythm) return "Please select the desired rhythm.";
  if (!payload.client_profile) return "Please select a client profile.";
  if (!payload.preferred_contact) return "Please select a preferred contact method.";
  if (!payload.details || payload.details.length < 20 || payload.details.length > 3000) {
    return "Please share a bit more detail about the support you need.";
  }
  if (!payload.started_at || !payload.submitted_at) {
    return "Timing information is missing from the request.";
  }
  return "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sendNotification({
  resendApiKey,
  notifyToEmail,
  notifyFromEmail,
  inquiry,
}: {
  resendApiKey: string;
  notifyToEmail: string;
  notifyFromEmail: string;
  inquiry: {
    id: string;
    created_at: string;
    name: string;
    email: string;
    support_type: string;
    rhythm: string;
    client_profile: string;
    preferred_contact: string;
    details: string;
  };
}) {
  const html = `
    <h2>New House of Deb inquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(inquiry.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(inquiry.email)}</p>
    <p><strong>Support Type:</strong> ${escapeHtml(inquiry.support_type)}</p>
    <p><strong>Rhythm:</strong> ${escapeHtml(inquiry.rhythm)}</p>
    <p><strong>Client Profile:</strong> ${escapeHtml(inquiry.client_profile)}</p>
    <p><strong>Preferred Contact:</strong> ${escapeHtml(inquiry.preferred_contact)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(inquiry.created_at)}</p>
    <p><strong>Details:</strong></p>
    <p>${escapeHtml(inquiry.details).replaceAll("\n", "<br />")}</p>
    <p><strong>Inquiry ID:</strong> ${escapeHtml(inquiry.id)}</p>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: notifyFromEmail,
      to: [notifyToEmail],
      subject: `New House of Deb inquiry from ${inquiry.name}`,
      html,
    }),
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
