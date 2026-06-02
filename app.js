const USERS_KEY = "story_desk_users_v2";
const SESSION_KEY = "story_desk_session_v2";
const THEME_KEY = "story_desk_theme_v1";
const FONT_KEY = "story_desk_font_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let currentUser = null;
let stories = [];
let currentId = null;
let autosaveTimer = null;
let deferredInstallPrompt = null;
let readerFontSize = 18;

const els = {
  authScreen: $("#authScreen"),
  app: $("#app"),
  loginTab: $("#loginTab"),
  registerTab: $("#registerTab"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  loginIdentity: $("#loginIdentity"),
  loginPassword: $("#loginPassword"),
  rememberLogin: $("#rememberLogin"),
  registerDisplayName: $("#registerDisplayName"),
  registerUsername: $("#registerUsername"),
  registerEmail: $("#registerEmail"),
  registerPassword: $("#registerPassword"),

  sidebar: $("#sidebar"),
  menuBtn: $("#menuBtn"),
  installBtn: $("#installBtn"),
  themeBtn: $("#themeBtn"),
  fontSelect: $("#fontSelect"),
  logoutBtn: $("#logoutBtn"),
  logoutBtn2: $("#logoutBtn2"),
  currentUserName: $("#currentUserName"),
  accountDisplayName: $("#accountDisplayName"),
  accountUsername: $("#accountUsername"),
  accountEmail: $("#accountEmail"),

  searchInput: $("#searchInput"),
  publishedList: $("#publishedList"),
  draftList: $("#draftList"),
  publishedManageList: $("#publishedManageList"),
  statAll: $("#statAll"),
  statDraft: $("#statDraft"),
  statPublished: $("#statPublished"),
  editorTitle: $("#editorTitle"),
  saveState: $("#saveState"),
  titleInput: $("#titleInput"),
  authorInput: $("#authorInput"),
  categoryInput: $("#categoryInput"),
  tagsInput: $("#tagsInput"),
  contentInput: $("#contentInput"),
  wordCount: $("#wordCount"),
  charCount: $("#charCount"),
  newStoryBtn: $("#newStoryBtn"),
  deleteStoryBtn: $("#deleteStoryBtn"),
  saveDraftBtn: $("#saveDraftBtn"),
  publishBtn: $("#publishBtn"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
  readerDialog: $("#readerDialog"),
  closeReaderBtn: $("#closeReaderBtn"),
  readerTitle: $("#readerTitle"),
  readerAuthor: $("#readerAuthor"),
  readerCategory: $("#readerCategory"),
  readerDate: $("#readerDate"),
  readerContent: $("#readerContent"),
  fontMinusBtn: $("#fontMinusBtn"),
  fontPlusBtn: $("#fontPlusBtn"),
  toast: $("#toast"),
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeUsername(username) {
  return username.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function storiesKeyFor(userId) {
  return `story_desk_stories_${userId}_v2`;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password, username) {
  return sha256(`${normalizeUsername(username)}::${password}`);
}

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function saveSession(user, remember) {
  const session = {
    userId: user.id,
    remember: Boolean(remember),
    createdAt: nowIso(),
  };

  if (remember) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(SESSION_KEY);
  }
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function showAuth() {
  els.authScreen.classList.remove("hidden");
  els.app.classList.add("hidden");
}

function showApp() {
  els.authScreen.classList.add("hidden");
  els.app.classList.remove("hidden");
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  els.loginTab.classList.toggle("active", isLogin);
  els.registerTab.classList.toggle("active", !isLogin);
  els.loginForm.classList.toggle("active", isLogin);
  els.registerForm.classList.toggle("active", !isLogin);
}

async function handleRegister(event) {
  event.preventDefault();

  const displayName = els.registerDisplayName.value.trim();
  const username = normalizeUsername(els.registerUsername.value);
  const email = normalizeEmail(els.registerEmail.value);
  const password = els.registerPassword.value;

  if (!displayName) return showToast("Cần nhập tên hiển thị");
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    return showToast("Tên đăng nhập 3-24 ký tự, chỉ dùng chữ, số, dấu ., _, -");
  }
  if (!email.includes("@")) return showToast("Email không hợp lệ");
  if (password.length < 6) return showToast("Mật khẩu cần ít nhất 6 ký tự");

  const users = loadUsers();
  const existed = users.some((user) => user.username === username || user.email === email);
  if (existed) return showToast("Tên đăng nhập hoặc email đã tồn tại");

  const user = {
    id: makeId(),
    username,
    email,
    displayName,
    passwordHash: await passwordHash(password, username),
    createdAt: nowIso(),
  };

  users.push(user);
  saveUsers(users);
  saveSession(user, true);

  els.registerForm.reset();
  await loginUser(user, true);
  showToast("Tạo tài khoản thành công");
}

async function handleLogin(event) {
  event.preventDefault();

  const identity = els.loginIdentity.value.trim().toLowerCase();
  const password = els.loginPassword.value;
  const remember = els.rememberLogin.checked;

  const users = loadUsers();
  const user = users.find((item) => item.username === identity || item.email === identity);

  if (!user) return showToast("Không tìm thấy tài khoản");

  const inputHash = await passwordHash(password, user.username);
  if (inputHash !== user.passwordHash) return showToast("Sai mật khẩu");

  saveSession(user, remember);
  els.loginForm.reset();
  await loginUser(user, remember);
  showToast("Đăng nhập thành công");
}

async function tryRestoreSession() {
  const session = getSession();
  if (!session?.userId) {
    showAuth();
    return;
  }

  const user = loadUsers().find((item) => item.id === session.userId);
  if (!user) {
    clearSession();
    showAuth();
    return;
  }

  await loginUser(user, session.remember);
}

async function loginUser(user) {
  currentUser = getSafeUser(user);
  loadStories();
  updateUserUI();
  clearEditor();
  renderAll();
  showApp();
  navigate("home");
}

function logout() {
  if (currentId) autoSaveDraft();
  currentUser = null;
  stories = [];
  currentId = null;
  clearSession();
  clearEditor();
  showAuth();
  showToast("Đã đăng xuất");
}

function updateUserUI() {
  if (!currentUser) return;
  els.currentUserName.textContent = currentUser.displayName || currentUser.username;
  els.accountDisplayName.textContent = currentUser.displayName || "";
  els.accountUsername.textContent = currentUser.username || "";
  els.accountEmail.textContent = currentUser.email || "";
}

function formatDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function loadStories() {
  if (!currentUser) {
    stories = [];
    return;
  }

  try {
    stories = JSON.parse(localStorage.getItem(storiesKeyFor(currentUser.id)) || "[]");
  } catch {
    stories = [];
  }

  if (!Array.isArray(stories)) stories = [];
}

function saveStories() {
  if (!currentUser) return;
  localStorage.setItem(storiesKeyFor(currentUser.id), JSON.stringify(stories));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function escapeHtml(text = "") {
  return text.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function plainPreview(text = "", max = 150) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? compact.slice(0, max).trim() + "..." : compact || "Chưa có nội dung.";
}

function currentFormData(status = "draft") {
  const existed = stories.find((story) => story.id === currentId);
  const createdAt = existed?.createdAt || nowIso();

  return {
    id: currentId || makeId(),
    title: els.titleInput.value.trim() || "Chưa đặt tên",
    author: els.authorInput.value.trim() || currentUser?.displayName || "Ẩn danh",
    category: els.categoryInput.value,
    tags: els.tagsInput.value.trim(),
    content: els.contentInput.value,
    status,
    ownerId: currentUser?.id,
    createdAt,
    updatedAt: nowIso(),
    publishedAt: status === "published" ? (existed?.publishedAt || nowIso()) : existed?.publishedAt || null,
  };
}

function upsertStory(story) {
  const index = stories.findIndex((item) => item.id === story.id);
  if (index >= 0) stories[index] = story;
  else stories.unshift(story);
  currentId = story.id;
  saveStories();
  renderAll();
}

function setSaveState(text) {
  els.saveState.textContent = text;
}

function hasEditorContent() {
  return (
    els.titleInput.value.trim() ||
    els.authorInput.value.trim() ||
    els.tagsInput.value.trim() ||
    els.contentInput.value.trim()
  );
}

function autoSaveDraft() {
  if (!currentUser || !hasEditorContent()) return;
  const old = stories.find((story) => story.id === currentId);
  const status = old?.status === "published" ? "published" : "draft";
  const story = currentFormData(status);
  upsertStory(story);
  setSaveState(`Đã tự lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  updateCounter();
  setSaveState("Đang viết...");
  autosaveTimer = setTimeout(autoSaveDraft, 700);
}

function updateCounter() {
  const text = els.contentInput.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  els.wordCount.textContent = `${words} từ`;
  els.charCount.textContent = `${els.contentInput.value.length} ký tự`;
}

function clearEditor() {
  currentId = null;
  els.editorTitle.textContent = "Viết truyện mới";
  els.titleInput.value = "";
  els.authorInput.value = currentUser?.displayName || "";
  els.categoryInput.value = "Tự do";
  els.tagsInput.value = "";
  els.contentInput.value = "";
  updateCounter();
  setSaveState("Chưa có thay đổi");
}

function openEditor(id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;

  currentId = story.id;
  els.editorTitle.textContent = story.status === "published" ? "Sửa bài đã đăng" : "Sửa bản nháp";
  els.titleInput.value = story.title || "";
  els.authorInput.value = story.author || "";
  els.categoryInput.value = story.category || "Tự do";
  els.tagsInput.value = story.tags || "";
  els.contentInput.value = story.content || "";
  updateCounter();
  setSaveState(`Lần sửa cuối: ${formatDate(story.updatedAt)}`);
  navigate("editor");
}

function saveDraft() {
  if (!currentUser) return showToast("Cần đăng nhập");
  const story = currentFormData("draft");
  upsertStory(story);
  setSaveState("Đã lưu nháp");
  showToast("Đã lưu bản nháp");
}

function publishStory() {
  if (!currentUser) return showToast("Cần đăng nhập");
  if (!els.titleInput.value.trim() && !els.contentInput.value.trim()) {
    showToast("Cần nhập tiêu đề hoặc nội dung trước khi đăng");
    return;
  }
  const story = currentFormData("published");
  upsertStory(story);
  setSaveState("Đã đăng bài");
  showToast("Đã đăng bài");
  navigate("published");
}

function deleteCurrentStory() {
  if (!currentId) {
    clearEditor();
    showToast("Không có bài để xóa");
    return;
  }
  const story = stories.find((item) => item.id === currentId);
  const ok = confirm(`Xóa "${story?.title || "bài này"}"?`);
  if (!ok) return;

  stories = stories.filter((item) => item.id !== currentId);
  saveStories();
  clearEditor();
  renderAll();
  showToast("Đã xóa");
}

function publishExisting(id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;
  story.status = "published";
  story.updatedAt = nowIso();
  story.publishedAt = story.publishedAt || nowIso();
  saveStories();
  renderAll();
  showToast("Đã đăng bài");
}

function moveToDraft(id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;
  story.status = "draft";
  story.updatedAt = nowIso();
  saveStories();
  renderAll();
  showToast("Đã chuyển về bản nháp");
}

function deleteStoryById(id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;
  if (!confirm(`Xóa "${story.title}"?`)) return;
  stories = stories.filter((item) => item.id !== id);
  saveStories();
  renderAll();
  showToast("Đã xóa");
}

function openReader(id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;

  els.readerTitle.textContent = story.title;
  els.readerAuthor.textContent = `Tác giả: ${story.author || "Ẩn danh"}`;
  els.readerCategory.textContent = story.category || "Tự do";
  els.readerDate.textContent = story.publishedAt ? `Đăng: ${formatDate(story.publishedAt)}` : `Sửa: ${formatDate(story.updatedAt)}`;
  els.readerContent.textContent = story.content || "Chưa có nội dung.";
  els.readerContent.style.setProperty("--reader-size", `${readerFontSize}px`);

  if (typeof els.readerDialog.showModal === "function") els.readerDialog.showModal();
  else alert(story.content);
}

function storyCard(story) {
  return `
    <article class="story-card">
      <div class="meta">
        <span class="badge">${escapeHtml(story.category || "Tự do")}</span>
        <span>${escapeHtml(formatDate(story.publishedAt || story.updatedAt))}</span>
      </div>
      <h4>${escapeHtml(story.title)}</h4>
      <p>${escapeHtml(plainPreview(story.content))}</p>
      <div class="card-actions">
        <button class="primary-btn" data-read="${story.id}">Đọc</button>
        <button class="ghost-btn" data-edit="${story.id}">Sửa</button>
      </div>
    </article>
  `;
}

function storyRow(story, type) {
  const isDraft = type === "draft";
  return `
    <article class="story-row">
      <div>
        <div class="meta">
          <span class="badge">${escapeHtml(story.category || "Tự do")}</span>
          <span>${isDraft ? "Sửa" : "Đăng"}: ${escapeHtml(formatDate(isDraft ? story.updatedAt : story.publishedAt))}</span>
          ${story.tags ? `<span>#${escapeHtml(story.tags.split(",")[0].trim())}</span>` : ""}
        </div>
        <h4>${escapeHtml(story.title)}</h4>
        <p>${escapeHtml(plainPreview(story.content, 190))}</p>
      </div>
      <div class="card-actions">
        ${isDraft ? `<button class="primary-btn" data-publish="${story.id}">Đăng</button>` : `<button class="primary-btn" data-read="${story.id}">Đọc</button>`}
        <button class="ghost-btn" data-edit="${story.id}">Sửa</button>
        ${isDraft ? "" : `<button class="ghost-btn" data-draft="${story.id}">Về nháp</button>`}
        <button class="ghost-btn danger" data-delete="${story.id}">Xóa</button>
      </div>
    </article>
  `;
}

function renderStats() {
  els.statAll.textContent = stories.length;
  els.statDraft.textContent = stories.filter((s) => s.status === "draft").length;
  els.statPublished.textContent = stories.filter((s) => s.status === "published").length;
}

function renderPublished() {
  const q = els.searchInput.value.trim().toLowerCase();
  const published = stories
    .filter((s) => s.status === "published")
    .filter((s) => {
      if (!q) return true;
      return `${s.title} ${s.author} ${s.category} ${s.tags} ${s.content}`.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.publishedAt || b.updatedAt) - new Date(a.publishedAt || a.updatedAt));

  els.publishedList.innerHTML = published.length
    ? published.map(storyCard).join("")
    : `<div class="empty">Chưa có truyện đã đăng.</div>`;

  const allPublished = stories
    .filter((s) => s.status === "published")
    .sort((a, b) => new Date(b.publishedAt || b.updatedAt) - new Date(a.publishedAt || a.updatedAt));

  els.publishedManageList.innerHTML = allPublished.length
    ? allPublished.map((story) => storyRow(story, "published")).join("")
    : `<div class="empty">Chưa có bài đã đăng.</div>`;
}

function renderDrafts() {
  const drafts = stories
    .filter((s) => s.status === "draft")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  els.draftList.innerHTML = drafts.length
    ? drafts.map((story) => storyRow(story, "draft")).join("")
    : `<div class="empty">Chưa có bản nháp.</div>`;
}

function renderAll() {
  renderStats();
  renderPublished();
  renderDrafts();
}

function navigate(route) {
  const viewMap = {
    home: "homeView",
    editor: "editorView",
    drafts: "draftsView",
    published: "publishedView",
    account: "accountView",
    backup: "backupView",
  };

  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewMap[route] || "homeView"}`).classList.add("active");

  $$(".nav-item, .bottom-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === route);
  });

  els.sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportData() {
  if (!currentUser) return;
  const payload = {
    app: "Hiền Story",
    version: 2,
    exportedAt: nowIso(),
    user: currentUser,
    stories,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `story-desk-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Đã xuất file sao lưu");
}

function importData(file) {
  if (!file || !currentUser) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const imported = Array.isArray(payload) ? payload : payload.stories;
      if (!Array.isArray(imported)) throw new Error("Invalid file");

      const normalized = imported.map((item) => ({
        id: item.id || makeId(),
        title: item.title || "Chưa đặt tên",
        author: item.author || currentUser.displayName || "Ẩn danh",
        category: item.category || "Tự do",
        tags: item.tags || "",
        content: item.content || "",
        status: item.status === "published" ? "published" : "draft",
        ownerId: currentUser.id,
        createdAt: item.createdAt || nowIso(),
        updatedAt: item.updatedAt || nowIso(),
        publishedAt: item.publishedAt || null,
      }));

      stories = normalized;
      saveStories();
      renderAll();
      showToast("Đã nhập dữ liệu");
      navigate("home");
    } catch {
      showToast("File không đúng định dạng");
    }
  };
  reader.readAsText(file);
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  document.body.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("light", theme !== "dark");
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark");
  document.body.classList.toggle("light", !isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function applyFont() {
  const font = localStorage.getItem(FONT_KEY) || "soft";
  document.body.classList.remove("font-soft", "font-modern", "font-classic", "font-cute");
  document.body.classList.add(`font-${font}`);
  if (els.fontSelect) els.fontSelect.value = font;
}

function changeFont() {
  const font = els.fontSelect?.value || "soft";
  localStorage.setItem(FONT_KEY, font);
  applyFont();
}


function bindEvents() {
  els.loginTab.addEventListener("click", () => switchAuthMode("login"));
  els.registerTab.addEventListener("click", () => switchAuthMode("register"));
  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);

  $$("[data-route]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.route));
  });

  document.addEventListener("click", (event) => {
    const readId = event.target.closest("[data-read]")?.dataset.read;
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const publishId = event.target.closest("[data-publish]")?.dataset.publish;
    const draftId = event.target.closest("[data-draft]")?.dataset.draft;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;

    if (readId) openReader(readId);
    if (editId) openEditor(editId);
    if (publishId) publishExisting(publishId);
    if (draftId) moveToDraft(draftId);
    if (deleteId) deleteStoryById(deleteId);
  });

  els.menuBtn.addEventListener("click", () => els.sidebar.classList.toggle("open"));
  els.themeBtn.addEventListener("click", toggleTheme);
  if (els.fontSelect) els.fontSelect.addEventListener("change", changeFont);
  els.logoutBtn.addEventListener("click", logout);
  els.logoutBtn2.addEventListener("click", logout);
  els.searchInput.addEventListener("input", renderPublished);

  [els.titleInput, els.authorInput, els.categoryInput, els.tagsInput, els.contentInput].forEach((el) => {
    el.addEventListener("input", scheduleAutosave);
    el.addEventListener("change", scheduleAutosave);
  });

  els.newStoryBtn.addEventListener("click", clearEditor);
  els.deleteStoryBtn.addEventListener("click", deleteCurrentStory);
  els.saveDraftBtn.addEventListener("click", saveDraft);
  els.publishBtn.addEventListener("click", publishStory);
  els.exportBtn.addEventListener("click", exportData);
  els.importInput.addEventListener("change", (e) => importData(e.target.files[0]));

  els.closeReaderBtn.addEventListener("click", () => els.readerDialog.close());
  els.fontMinusBtn.addEventListener("click", () => {
    readerFontSize = Math.max(15, readerFontSize - 1);
    els.readerContent.style.setProperty("--reader-size", `${readerFontSize}px`);
  });
  els.fontPlusBtn.addEventListener("click", () => {
    readerFontSize = Math.min(28, readerFontSize + 1);
    els.readerContent.style.setProperty("--reader-size", `${readerFontSize}px`);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      console.warn("Service worker registration failed.");
    });
  }
}

applyTheme();
applyFont();
bindEvents();
registerServiceWorker();
tryRestoreSession();
