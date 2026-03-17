import { getSupabaseClient } from "./supabase-browser.js";

const supabase = getSupabaseClient();
const authPanel = document.querySelector("#auth-panel");
const dashboard = document.querySelector("#dashboard");
const authForm = document.querySelector("#auth-form");
const authNote = document.querySelector("#auth-note");
const authSubmit = document.querySelector("#auth-submit");
const signOutButton = document.querySelector("#sign-out-button");
const refreshButton = document.querySelector("#refresh-button");
const statusFilter = document.querySelector("#status-filter");
const inquiryList = document.querySelector("#inquiry-list");
const dashboardNote = document.querySelector("#dashboard-note");
const totalCount = document.querySelector("#total-count");
const newCount = document.querySelector("#new-count");
const qualifiedCount = document.querySelector("#qualified-count");

init();

async function init() {
  if (!supabase) {
    setAuthState(false);
    if (authNote) {
      authNote.textContent = "Supabase env keys are missing. Add them before using the admin dashboard.";
      authNote.className = "form-note is-error";
    }
    return;
  }

  await supabase.auth.getSession();
  const { data } = await supabase.auth.getSession();
  setAuthState(Boolean(data.session));

  if (data.session) {
    await loadInquiries();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setAuthState(Boolean(session));
    if (session) {
      await loadInquiries();
    } else if (inquiryList) {
      inquiryList.innerHTML = "";
    }
  });
}

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase || !authForm || !authSubmit || !authNote) return;

  const formData = new FormData(authForm);
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email) return;

  authSubmit.disabled = true;
  authSubmit.textContent = "Sending...";
  authNote.textContent = "Sending a secure magic link to your inbox...";
  authNote.className = "form-note";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/admin.html`,
    },
  });

  authSubmit.disabled = false;
  authSubmit.textContent = "Send Magic Link";

  if (error) {
    authNote.textContent = error.message;
    authNote.className = "form-note is-error";
    return;
  }

  authNote.textContent = "Magic link sent. Open it on this device to access the dashboard.";
  authNote.className = "form-note is-success";
});

signOutButton?.addEventListener("click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
});

refreshButton?.addEventListener("click", async () => {
  await loadInquiries();
});

statusFilter?.addEventListener("change", async () => {
  await loadInquiries();
});

async function loadInquiries() {
  if (!supabase || !inquiryList || !dashboardNote) return;

  dashboardNote.textContent = "Loading inquiries...";
  dashboardNote.className = "form-note";

  let query = supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  const selectedStatus = statusFilter?.value ?? "all";
  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  const { data, error } = await query;

  if (error) {
    dashboardNote.textContent = error.message;
    dashboardNote.className = "form-note is-error";
    inquiryList.innerHTML = "";
    return;
  }

  renderSummary(data ?? []);
  renderInquiries(data ?? []);
}

function renderSummary(items) {
  if (!totalCount || !newCount || !qualifiedCount) return;

  totalCount.textContent = `${items.length}`;
  newCount.textContent = `${items.filter((item) => item.status === "new").length}`;
  qualifiedCount.textContent = `${items.filter((item) => item.status === "qualified").length}`;
}

function renderInquiries(items) {
  if (!inquiryList || !dashboardNote) return;

  if (!items.length) {
    dashboardNote.textContent = "No inquiries found for this filter.";
    dashboardNote.className = "form-note";
    inquiryList.innerHTML = "";
    return;
  }

  dashboardNote.textContent = `${items.length} inquiry${items.length === 1 ? "" : "ies"} loaded.`;
  dashboardNote.className = "form-note";

  inquiryList.innerHTML = items
    .map(
      (item) => `
        <article class="admin-inquiry-card">
          <div class="admin-inquiry-top">
            <div>
              <p class="section-tag">${escapeHtml(formatDate(item.created_at))}</p>
              <h3>${escapeHtml(item.name)}</h3>
            </div>
            <span class="status-badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          </div>

          <div class="admin-meta-grid">
            <p><strong>Email:</strong> ${escapeHtml(item.email)}</p>
            <p><strong>Support:</strong> ${escapeHtml(item.support_type)}</p>
            <p><strong>Rhythm:</strong> ${escapeHtml(item.rhythm)}</p>
            <p><strong>Profile:</strong> ${escapeHtml(item.client_profile)}</p>
            <p><strong>Preferred Contact:</strong> ${escapeHtml(item.preferred_contact)}</p>
            <p><strong>Source:</strong> ${escapeHtml(item.source ?? "website")}</p>
          </div>

          <p class="admin-details">${escapeHtml(item.details)}</p>

          <div class="admin-card-actions">
            <label class="field inline-field">
              <span>Update Status</span>
              <select data-status-id="${item.id}">
                ${renderStatusOptions(item.status)}
              </select>
            </label>
            <button class="button button-secondary status-save" data-save-id="${item.id}" type="button">
              Save
            </button>
          </div>
        </article>
      `
    )
    .join("");

  inquiryList.querySelectorAll(".status-save").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-save-id");
      const select = inquiryList.querySelector(`[data-status-id="${id}"]`);
      const status = select?.value;
      if (!id || !status) return;
      await updateStatus(id, status, button);
    });
  });
}

async function updateStatus(id, status, button) {
  if (!supabase || !dashboardNote) return;

  button.disabled = true;
  button.textContent = "Saving...";

  const payload = {
    status,
    updated_at: new Date().toISOString(),
    contacted_at: status === "qualified" ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("inquiries").update(payload).eq("id", id);

  button.disabled = false;
  button.textContent = "Save";

  if (error) {
    dashboardNote.textContent = error.message;
    dashboardNote.className = "form-note is-error";
    return;
  }

  dashboardNote.textContent = "Inquiry updated.";
  dashboardNote.className = "form-note is-success";
  await loadInquiries();
}

function setAuthState(isSignedIn) {
  authPanel?.classList.toggle("hidden", isSignedIn);
  dashboard?.classList.toggle("hidden", !isSignedIn);
  signOutButton?.classList.toggle("hidden", !isSignedIn);
}

function renderStatusOptions(currentStatus) {
  return ["new", "reviewing", "qualified", "closed"]
    .map(
      (status) =>
        `<option value="${status}" ${currentStatus === status ? "selected" : ""}>${status}</option>`
    )
    .join("");
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
