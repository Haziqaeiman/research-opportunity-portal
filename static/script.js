// script.js - frontend logic.
// It never stores opportunities itself: every action calls the Flask REST API,
// and the API talks to MySQL. The list on screen is always what the API returns.

const API = "/api/opportunities";   // same server that served this page (Flask, port 5000)

const messageBox = document.getElementById("message");
const listBox = document.getElementById("list");
const detailsBox = document.getElementById("details");
const form = document.getElementById("oppForm");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");

// The text/number/date fields in the form (same names as the database columns).
const FIELDS = ["title", "description", "research_area", "faculty_name",
                "department", "required_skills", "positions", "deadline"];
const FIELD_LABELS = {
  title: "Research title", description: "Research description", research_area: "Research area",
  faculty_name: "Faculty member's name", department: "Department", required_skills: "Required skills",
  positions: "Number of positions", deadline: "Application deadline",
};

let messageTimer = null;

// ---------------------------------------------------------------- messages
function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = "message " + type;   // "success" or "error"
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => messageBox.classList.add("hidden"), 6000);
}

// ---------------------------------------------------------------- API helper
// Sends a request and returns {ok, status, data}.
// If the server cannot be reached at all, it returns ok:false with a clear error,
// so the page never shows "success" when the request failed.
async function callApi(url, method, body) {
  try {
    const options = { method: method, headers: {} };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    let data = null;
    try { data = await response.json(); } catch (e) { data = null; }
    return { ok: response.ok, status: response.status, data: data };
  } catch (networkError) {
    return { ok: false, status: 0, data: { error: "Cannot reach the server. Is the Flask backend running?" } };
  }
}

function errorText(result) {
  const msg = (result.data && result.data.error) ? result.data.error : "Something went wrong.";
  return "Error " + (result.status || "") + ": " + msg;
}

// ---------------------------------------------------------------- safe text
// Escape text before putting it in HTML so nobody can inject tags/scripts.
function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

// ---------------------------------------------------------------- 1. list all (GET)
async function loadList() {
  const result = await callApi(API, "GET");
  if (!result.ok) {
    listBox.innerHTML = '<p class="muted">Could not load opportunities.</p>';
    showMessage(errorText(result), "error");
    return;
  }
  const items = result.data;
  if (items.length === 0) {
    listBox.innerHTML = '<p class="muted">No opportunities yet. Create one using the form.</p>';
    return;
  }
  listBox.innerHTML = items.map(item => `
    <div class="card">
      <h3>${esc(item.title)} <span class="badge ${esc(item.status)}">${esc(item.status)}</span></h3>
      <p>${esc(item.faculty_name)} &middot; ${esc(item.department)}</p>
      <p>Positions: ${esc(item.positions)} &middot; Deadline: ${esc(item.deadline)}</p>
      <div class="actions">
        <button class="btn" onclick="viewOne(${item.id})">View</button>
        <button class="btn" onclick="startEdit(${item.id})">Edit</button>
        ${item.status === "Open"
          ? `<button class="btn warn" onclick="closeOne(${item.id})">Close</button>` : ""}
        <button class="btn danger" onclick="deleteOne(${item.id})">Delete</button>
      </div>
    </div>`).join("");
}

// ---------------------------------------------------------------- 2. view details (GET /:id)
async function viewOne(id) {
  const result = await callApi(API + "/" + id, "GET");
  if (!result.ok) {
    detailsBox.innerHTML = '<p class="muted">Could not load details.</p>';
    showMessage(errorText(result), "error");   // shows 404 if it was deleted
    loadList();
    return;
  }
  const o = result.data;
  detailsBox.innerHTML = `
    <table class="details-table">
      <tr><td>ID</td><td>${esc(o.id)}</td></tr>
      <tr><td>Title</td><td>${esc(o.title)}</td></tr>
      <tr><td>Description</td><td>${esc(o.description)}</td></tr>
      <tr><td>Research area</td><td>${esc(o.research_area)}</td></tr>
      <tr><td>Faculty member</td><td>${esc(o.faculty_name)}</td></tr>
      <tr><td>Department</td><td>${esc(o.department)}</td></tr>
      <tr><td>Required skills</td><td>${esc(o.required_skills)}</td></tr>
      <tr><td>Available positions</td><td>${esc(o.positions)}</td></tr>
      <tr><td>Deadline</td><td>${esc(o.deadline)}</td></tr>
      <tr><td>Status</td><td><span class="badge ${esc(o.status)}">${esc(o.status)}</span></td></tr>
    </table>`;
}

// ---------------------------------------------------------------- form validation (frontend)
function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach(el => el.remove());
  document.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
}

function showFieldError(fieldId, text) {
  const input = document.getElementById(fieldId);
  input.classList.add("invalid");
  const small = document.createElement("div");
  small.className = "field-error";
  small.textContent = text;
  input.insertAdjacentElement("afterend", small);
}

// Returns true if all required fields are filled and valid.
function validateForm() {
  clearFieldErrors();
  let valid = true;
  for (const f of FIELDS) {
    const value = document.getElementById(f).value.trim();
    if (value === "") {
      showFieldError(f, FIELD_LABELS[f] + " is required.");
      valid = false;
    }
  }
  const pos = document.getElementById("positions").value.trim();
  if (pos !== "" && (!/^\d+$/.test(pos) || parseInt(pos, 10) < 1)) {
    showFieldError("positions", "Positions must be a whole number of 1 or more.");
    valid = false;
  }
  return valid;
}

// ---------------------------------------------------------------- 3. create / update (POST / PUT)
form.addEventListener("submit", async function (event) {
  event.preventDefault();                       // stop the browser reloading the page
  if (!validateForm()) {
    showMessage("Please fix the highlighted fields.", "error");
    return;
  }

  const body = {};
  for (const f of FIELDS) body[f] = document.getElementById(f).value.trim();
  body.positions = parseInt(body.positions, 10);
  body.status = document.getElementById("status").value;

  const id = document.getElementById("oppId").value;
  let result;
  if (id === "") {
    result = await callApi(API, "POST", body);            // create
  } else {
    result = await callApi(API + "/" + id, "PUT", body);  // update
  }

  if (!result.ok) {                              // only show success if the API said OK
    showMessage(errorText(result), "error");
    return;
  }
  showMessage(id === "" ? "Opportunity created successfully." : "Opportunity updated successfully.", "success");
  resetForm();
  await loadList();
  if (id !== "") viewOne(id);                    // refresh the details panel with new data
});

// ---------------------------------------------------------------- 4. start editing
async function startEdit(id) {
  const result = await callApi(API + "/" + id, "GET");   // load the real stored values
  if (!result.ok) {
    showMessage(errorText(result), "error");
    loadList();
    return;
  }
  const o = result.data;
  clearFieldErrors();
  document.getElementById("oppId").value = o.id;
  for (const f of FIELDS) document.getElementById(f).value = o[f];
  document.getElementById("status").value = o.status;
  formTitle.textContent = "Update Opportunity #" + o.id;
  submitBtn.textContent = "Save Changes";
  cancelBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  form.reset();
  document.getElementById("oppId").value = "";
  clearFieldErrors();
  formTitle.textContent = "Create New Opportunity";
  submitBtn.textContent = "Create Opportunity";
  cancelBtn.classList.add("hidden");
}
cancelBtn.addEventListener("click", resetForm);

// ---------------------------------------------------------------- 5. close (PUT with status only)
async function closeOne(id) {
  const result = await callApi(API + "/" + id, "PUT", { status: "Closed" });
  if (!result.ok) {
    showMessage(errorText(result), "error");
    loadList();
    return;
  }
  showMessage("Opportunity " + id + " is now Closed.", "success");
  await loadList();
  viewOne(id);
}

// ---------------------------------------------------------------- 6. delete (DELETE)
async function deleteOne(id) {
  if (!confirm("Delete opportunity " + id + "? This cannot be undone.")) return;
  const result = await callApi(API + "/" + id, "DELETE");
  if (!result.ok) {
    showMessage(errorText(result), "error");
    loadList();
    return;
  }
  showMessage("Opportunity " + id + " deleted successfully.", "success");
  if (document.getElementById("oppId").value === String(id)) resetForm();
  detailsBox.innerHTML = '<p class="muted">Click "View" on an opportunity to see its full details.</p>';
  loadList();
}

// ---------------------------------------------------------------- start
loadList();   // when the page opens, fetch the opportunities from the API
