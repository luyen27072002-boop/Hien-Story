/* PDF_BG_STUDIO: auth untouched, lighter editor addon */
(() => {
  const PREF_KEY = "hien_story_writer_prefs_v3";
  const EXTRA_KEYS = [
    "hien_story_story_extras_v3",
    "hien_story_story_extras_v2",
    "hien_story_story_extras_v1",
  ];
  const SAVE_KEY = EXTRA_KEYS[0];
  const SESSION_KEY = "story_desk_session_v2";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    storyId: null,
    cover: "",
    pageBg: "rose",
    chapters: [],
    chapterId: null,
  };

  /*
    FIX RELOAD TỰ THÊM BẢN NHÁP:
    Khi đang init/load/fresh nội bộ, không dispatch input sang app chính.
  */
  let suppressStorySync = false;

  const backgroundPalette = [
    "rose",
    "cream",
    "garden",
    "dream",
    "vintage",
    "blossom",
    "forest",
    "lilac",
    "diary",
  ];

  const fontMap = {
    literata: '"Literata", "Source Serif 4", serif',
    lora: '"Lora", "Source Serif 4", serif',
    serif: '"Source Serif 4", "Be Vietnam Pro", serif',
    noto: '"Noto Serif", "Source Serif 4", serif',
    dancing: '"Dancing Script", "Mali", cursive',
    greatvibes: '"Great Vibes", "Dancing Script", cursive',
    parisienne: '"Parisienne", "Dancing Script", cursive',
    caveat: '"Caveat", "Mali", cursive',
    mali: '"Mali", "Nunito", cursive',
    pacifico: '"Pacifico", "Mali", cursive',
    soft: '"Nunito", "Be Vietnam Pro", sans-serif',
    modern: '"Be Vietnam Pro", system-ui, sans-serif',
    elegant: '"Cormorant Garamond", "Merriweather", serif',
  };

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function escapeHtml(text = "") {
    return String(text).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[m],
    );
  }

  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getExtras() {
    for (const key of EXTRA_KEYS) {
      const val = readJson(key, null);
      if (val && typeof val === "object") return val;
    }
    return {};
  }

  function saveExtras(v) {
    writeJson(SAVE_KEY, v);
  }

  function getSession() {
    try {
      return JSON.parse(
        localStorage.getItem(SESSION_KEY) ||
          sessionStorage.getItem(SESSION_KEY) ||
          "null",
      );
    } catch {
      return null;
    }
  }

  function currentStoriesKey() {
    const s = getSession();
    return s?.userId ? `story_desk_stories_${s.userId}_v2` : null;
  }

  function readStories() {
    const key = currentStoriesKey();
    if (!key) return [];
    const v = readJson(key, []);
    return Array.isArray(v) ? v : [];
  }

  function normalizeText(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.innerText || div.textContent || "")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  function makeChapter(name = "Chương 1", html = "") {
    return { id: uid("chap"), title: name, html };
  }

  function prefs() {
    return {
      fontFamily: "literata",
      fontSize: "18",
      lineHeight: "1.50",
      pageBg: "rose",
      bold: false,
      italic: false,
      underline: false,
      ...readJson(PREF_KEY, {}),
    };
  }

  function savePrefs(part) {
    writeJson(PREF_KEY, { ...prefs(), ...part });
  }

  function e() {
    return {
      searchHolder: $(".home-top-search"),
      searchInput: $("#searchInput"),
      titleInput: $("#titleInput"),
      authorInput: $("#authorInput"),
      categoryInput: $("#categoryInput"),
      tagsInput: $("#tagsInput"),
      contentInput: $("#contentInput"),
      richEditor: $("#richEditor"),
      chapterList: $("#chapterList"),
      activeChapterLabel: $("#activeChapterLabel"),
      addChapterBtn: $("#addChapterBtn"),
      coverInput: $("#coverInput"),
      pickCoverBtn: $("#pickCoverBtn"),
      clearCoverBtn: $("#clearCoverBtn"),
      coverBadge: $("#coverBadge"),
      editorSizeSelect: $("#editorSizeSelect"),
      editorLineHeightSelect: $("#editorLineHeightSelect"),
      editorFontFamilySelect: $("#editorFontFamilySelect"),
      pageBgSelect: $("#pageBgSelect"),
      saveDraftBtn: $("#saveDraftBtn"),
      publishBtn: $("#publishBtn"),
      newStoryBtn: $("#newStoryBtn"),
      deleteStoryBtn: $("#deleteStoryBtn"),
      openPreviewBtn: $("#openPreviewBtn"),
      exportPdfBtn: $("#exportPdfBtn"),
      previewDialog: $("#previewDialog"),
      previewReaderBody: $("#previewReaderBody"),
      closePreviewBtn: $("#closePreviewBtn"),
      previewPdfBtn: $("#previewPdfBtn"),
      readerContent: $("#readerContent"),
    };
  }

  function applyPrefs() {
    const els = e();
    const p = prefs();

    if (els.editorFontFamilySelect) {
      els.editorFontFamilySelect.value = p.fontFamily;
    }

    if (els.editorSizeSelect) {
      els.editorSizeSelect.value = p.fontSize;
    }

    if (els.editorLineHeightSelect) {
      els.editorLineHeightSelect.value = p.lineHeight;
    }

    if (els.pageBgSelect) {
      els.pageBgSelect.value = state.pageBg || p.pageBg || "rose";
    }

    if (els.richEditor) {
      els.richEditor.dataset.pageBg = state.pageBg || p.pageBg || "rose";
    }

    $$("[data-exec]").forEach((btn) => {
      const cmd = btn.dataset.exec;
      if (cmd === "bold") btn.classList.toggle("active", Boolean(p.bold));
      if (cmd === "italic") btn.classList.toggle("active", Boolean(p.italic));
      if (cmd === "underline") {
        btn.classList.toggle("active", Boolean(p.underline));
      }
    });
  }

  function moveSearch() {
    const els = e();
    if (
      els.searchHolder &&
      els.searchInput &&
      !els.searchHolder.contains(els.searchInput)
    ) {
      els.searchHolder.appendChild(els.searchInput);
      els.searchInput.placeholder = "Tìm tiêu đề, nội dung...";
    }
  }

  function renderCoverBadge() {
    const els = e();
    if (!els.coverBadge) return;
    els.coverBadge.classList.toggle("hidden", !state.cover);
  }

  function setCover(dataUrl = "") {
    state.cover = dataUrl || "";
    renderCoverBadge();
  }

  function saveCurrentChapter() {
    const els = e();
    if (!els.richEditor || !state.chapterId) return;

    const ch = state.chapters.find((x) => x.id === state.chapterId);
    if (!ch) return;

    ch.html = els.richEditor.innerHTML || "";

    /*
      Quan trọng:
      Không syncTextarea trong lúc init/load/fresh nội bộ.
      Nếu sync lúc reload, contentInput bị dispatch input,
      app chính có thể tự tạo thêm một bản nháp mới.
    */
    if (!suppressStorySync) {
      syncTextarea();
    }
  }

  function syncTextarea() {
    const els = e();
    if (!els.contentInput) return;

    const txt = state.chapters
      .map(
        (ch, idx) =>
          `${ch.title || `Chương ${idx + 1}`}\n${normalizeText(ch.html)}`,
      )
      .join("\n\n")
      .trim();

    els.contentInput.value = txt;
    els.contentInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderChapterPills() {
    const els = e();
    if (!els.chapterList) return;

    els.chapterList.innerHTML = state.chapters
      .map(
        (ch, idx) =>
          `<div class="chapter-pill ${ch.id === state.chapterId ? "active" : ""}" data-chapter="${ch.id}"><span>${escapeHtml(ch.title || `Chương ${idx + 1}`)}</span><small>${escapeHtml(normalizeText(ch.html).slice(0, 18) || "trống")}</small><div class="pill-actions"><button type="button" data-rename="${ch.id}" title="Đổi tên">Aa</button><button type="button" data-delete="${ch.id}" title="Xóa">×</button></div></div>`,
      )
      .join("");
  }

  function activateChapter(id, options = {}) {
    /*
      Khi user chuyển chương thật sự thì lưu chương hiện tại.
      Khi init/load/fresh thì skipSave=true để tránh tự tạo draft.
    */
    if (!options.skipSave) {
      saveCurrentChapter();
    }

    state.chapterId = id;

    const ch = state.chapters.find((x) => x.id === id);
    const els = e();

    if (!ch || !els.richEditor) return;

    els.richEditor.innerHTML = ch.html || "";

    if (els.activeChapterLabel) {
      els.activeChapterLabel.textContent = ch.title || "Chương";
    }

    renderChapterPills();
    applyPrefs();
  }

  function addChapter() {
    saveCurrentChapter();

    const ch = makeChapter(`Chương ${state.chapters.length + 1}`, "");
    state.chapters.push(ch);

    activateChapter(ch.id);
  }

  function renameChapter(id) {
    const ch = state.chapters.find((x) => x.id === id);
    if (!ch) return;

    const next = (prompt("Đổi tên chương", ch.title || "") || "").trim();
    if (!next) return;

    ch.title = next;
    renderChapterPills();

    const els = e();
    if (id === state.chapterId && els.activeChapterLabel) {
      els.activeChapterLabel.textContent = next;
    }
  }

  function deleteChapter(id) {
    if (state.chapters.length <= 1) {
      state.chapters = [makeChapter("Chương 1", "")];
      state.chapterId = state.chapters[0].id;
      return activateChapter(state.chapterId, { skipSave: true });
    }

    state.chapters = state.chapters.filter((x) => x.id !== id);
    activateChapter(state.chapters[0].id);
  }

  function freshStoryState() {
    suppressStorySync = true;

    state.storyId = null;
    state.cover = "";
    state.pageBg = prefs().pageBg || "rose";
    state.chapters = [makeChapter("Chương 1", "")];
    state.chapterId = state.chapters[0].id;

    renderCoverBadge();
    renderChapterPills();
    activateChapter(state.chapterId, { skipSave: true });

    suppressStorySync = false;
  }

  function getExtra(id) {
    return id ? getExtras()[id] || null : null;
  }

  function loadExtra(id) {
    const els = e();

    suppressStorySync = true;

    state.storyId = id || null;
    const extra = getExtra(id);

    if (extra) {
      state.cover = extra.cover || "";
      state.pageBg = extra.pageBg || prefs().pageBg || "rose";
      state.chapters =
        Array.isArray(extra.chapters) && extra.chapters.length
          ? extra.chapters.map((ch, idx) => ({
              id: ch.id || uid("chap"),
              title: ch.title || `Chương ${idx + 1}`,
              html: ch.html || "",
            }))
          : [makeChapter("Chương 1", "")];
    } else {
      const plain = els.contentInput?.value?.trim() || "";
      state.cover = "";
      state.pageBg = prefs().pageBg || "rose";
      state.chapters = [
        makeChapter(
          "Chương 1",
          plain ? `<p>${escapeHtml(plain).replace(/\n/g, "<br>")}</p>` : "",
        ),
      ];
    }

    state.chapterId = state.chapters[0].id;

    renderCoverBadge();
    renderChapterPills();
    activateChapter(state.chapterId, { skipSave: true });

    suppressStorySync = false;
  }

  function persistExtra(snapshot = null) {
    saveCurrentChapter();

    const els = e();
    let id = state.storyId;
    const stories = readStories();

    if (!id || !stories.some((s) => s.id === id)) {
      if (snapshot?.beforeIds) {
        const newer = stories.find((s) => !snapshot.beforeIds.has(s.id));
        if (newer) id = newer.id;
      }

      if (!id) {
        const title = els.titleInput?.value?.trim();
        const sorted = stories
          .slice()
          .sort(
            (a, b) =>
              new Date(b.updatedAt || b.publishedAt || 0) -
              new Date(a.updatedAt || a.publishedAt || 0),
          );

        const found = title ? sorted.find((s) => s.title === title) : sorted[0];
        id = found?.id || null;
      }

      state.storyId = id;
    }

    if (!id) return;

    const extras = getExtras();

    extras[id] = {
      cover: state.cover || "",
      pageBg: state.pageBg || "rose",
      chapters: state.chapters.map((ch, idx) => ({
        id: ch.id,
        title: ch.title || `Chương ${idx + 1}`,
        html: ch.html || "",
      })),
      updatedAt: new Date().toISOString(),
    };

    saveExtras(extras);
    setTimeout(enhanceStoryLists, 120);
  }

  function stripHtml(html = "") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function pickChapterBg(idx, baseBg) {
    const palette = [
      "vintage",
      "blossom",
      "forest",
      "lilac",
      "diary",
      "cream",
      "garden",
      "dream",
      "rose",
    ];
    const start = Math.max(0, palette.indexOf(baseBg));
    return palette[(start + idx) % palette.length] || baseBg || "rose";
  }

  function firstExcerpt() {
    const chapter = state.chapters.find((ch) =>
      stripHtml(ch.html || "").trim(),
    );
    const text = chapter ? stripHtml(chapter.html || "") : "";
    if (!text) return "Một câu chuyện dịu dàng đang chờ được viết tiếp...";
    return text.slice(0, 220) + (text.length > 220 ? "..." : "");
  }

  function makePageNumber(n) {
    return `<div class="page-number">${String(n).padStart(2, "0")}</div>`;
  }

  function previewPagesHtml() {
    const els = e();
    const p = prefs();

    const title = (els.titleInput?.value || "").trim() || "Chưa đặt tên";
    const author = (els.authorInput?.value || "").trim() || "Ẩn danh";
    const category = els.categoryInput?.value || "Tự do";
    const tags = (els.tagsInput?.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    const coverBg = state.pageBg || p.pageBg || "rose";
    let pageNo = 1;

    const coverPage = `
      <section class="preview-page page-bg-${coverBg} preview-cover-page deluxe-cover">
        <div class="cover-glow"></div>
        <div class="cover-inner">
          <span class="story-theme-pill large">${escapeHtml(category)}</span>
          ${state.cover ? `<img src="${state.cover}" alt="Bìa truyện" />` : ""}
          <div class="cover-copy">
            <p class="cover-kicker">Hiền Story</p>
            <h2>${escapeHtml(title)}</h2>
            <p class="cover-author">Tác giả: ${escapeHtml(author)}</p>
            ${
              tags.length
                ? `<div class="story-extra-meta">${tags
                    .map(
                      (t) =>
                        `<span class="story-extra-pill">#${escapeHtml(t)}</span>`,
                    )
                    .join("")}</div>`
                : ""
            }
          </div>
        </div>
      </section>`;

    const chapters = state.chapters
      .map((ch, idx) => {
        const bg = pickChapterBg ? pickChapterBg(idx + 1, coverBg) : coverBg;
        const content =
          ch.html && ch.html.trim() ? ch.html : "<p>Chưa có nội dung.</p>";
        const chapterLabel = ch.title || `Chương ${idx + 1}`;

        const section = `
        <section class="preview-page page-bg-${bg} chapter-page deluxe-chapter-page">
          <div class="chapter-top-decor"></div>
          <div class="chapter-head">
            <span class="chapter-no">CHƯƠNG ${idx + 1}</span>
            <h3>${escapeHtml(chapterLabel)}</h3>
          </div>
          <div class="chapter-body">${content}</div>
          ${makePageNumber ? makePageNumber(pageNo + idx + 1) : ""}
        </section>`;

        return section;
      })
      .join("");

    return `<div class="preview-pages deluxe-pages">${coverPage}${chapters}</div>`;
  }

  function openPreview() {
    persistExtra();

    const els = e();
    if (els.previewReaderBody) {
      els.previewReaderBody.innerHTML = previewPagesHtml();
    }

    if (typeof els.previewDialog?.showModal === "function") {
      els.previewDialog.showModal();
    }
  }

  function exportPdf() {
    persistExtra();

    const p = prefs();

    const oldArea = document.getElementById("pdfPrintArea");
    if (oldArea) oldArea.remove();

    const oldStyle = document.getElementById("pdfPrintStyle");
    if (oldStyle) oldStyle.remove();

    const printArea = document.createElement("div");
    printArea.id = "pdfPrintArea";
    printArea.innerHTML = previewPagesHtml();
    document.body.appendChild(printArea);

    const printStyle = document.createElement("style");
    printStyle.id = "pdfPrintStyle";
    printStyle.textContent = `
      #pdfPrintArea {
        display: none;
      }

      @media print {
        @page {
          size: A4;
          margin: 0;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden !important;
        }

        #pdfPrintArea,
        #pdfPrintArea * {
          visibility: visible !important;
        }

        #pdfPrintArea {
          display: block !important;
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          background: white !important;
          font-family: ${fontMap[p.fontFamily] || fontMap.serif} !important;
          color: #3a2530 !important;
        }

        #pdfPrintArea .preview-pages {
          display: block !important;
        }

        #pdfPrintArea .preview-page {
          width: 210mm !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          padding: 22mm 18mm !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden !important;
          position: relative !important;
        }

        #pdfPrintArea .preview-cover-page {
          display: grid !important;
          gap: 18px !important;
          align-content: center !important;
          justify-items: center !important;
          text-align: center !important;
        }

        #pdfPrintArea .preview-cover-page img {
          width: min(100%, 150mm) !important;
          max-height: 90mm !important;
          object-fit: cover !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 24px rgba(62,37,48,.12) !important;
        }

        #pdfPrintArea .preview-cover-page h2 {
          margin: 0 !important;
          font-size: 26pt !important;
          line-height: 1.1 !important;
          font-family: "Playfair Display", "Source Serif 4", serif !important;
        }

        #pdfPrintArea .preview-cover-page p {
          margin: 0 !important;
          color: #8e6f7c !important;
          font-size: 12pt !important;
        }

        #pdfPrintArea .story-extra-meta {
          display: flex !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
        }

        #pdfPrintArea .story-extra-pill,
        #pdfPrintArea .story-theme-pill {
          min-height: 28px !important;
          padding: 0 10px !important;
          display: inline-flex !important;
          align-items: center !important;
          border-radius: 999px !important;
          background: rgba(223,99,146,.12) !important;
          color: #df6392 !important;
          font-size: 10pt !important;
          font-weight: 700 !important;
        }

        #pdfPrintArea .chapter-head {
          margin-bottom: 14px !important;
        }

        #pdfPrintArea .chapter-head h3 {
          margin: 0 0 4px !important;
          font-size: 20pt !important;
          line-height: 1.15 !important;
          font-family: "Playfair Display", "Source Serif 4", serif !important;
        }

        #pdfPrintArea .chapter-head span {
          color: #8e6f7c !important;
          font-size: 10pt !important;
          font-weight: 700 !important;
        }

        #pdfPrintArea .chapter-body {
          line-height: ${p.lineHeight} !important;
          font-size: ${p.fontSize}px !important;
        }

        #pdfPrintArea .chapter-body p,
        #pdfPrintArea .chapter-body div {
          margin: 0 0 1em !important;
        }

        #pdfPrintArea .page-bg-rose {
          background:
            radial-gradient(circle at 18% 12%, rgba(255,255,255,.58), transparent 22%),
            radial-gradient(circle at 82% 18%, rgba(255,229,239,.92), transparent 22%),
            linear-gradient(180deg, rgba(255,250,252,.98), rgba(255,242,247,.98)) !important;
        }

        #pdfPrintArea .page-bg-cream {
          background:
            radial-gradient(circle at 14% 10%, rgba(255,255,255,.46), transparent 18%),
            linear-gradient(180deg, rgba(255,251,241,.99), rgba(253,245,226,.99)) !important;
        }

        #pdfPrintArea .page-bg-garden {
          background:
            radial-gradient(circle at 85% 14%, rgba(220,244,221,.85), transparent 18%),
            radial-gradient(circle at 12% 82%, rgba(241,255,234,.95), transparent 22%),
            linear-gradient(180deg, rgba(250,255,249,.98), rgba(237,248,233,.98)) !important;
        }

        #pdfPrintArea .page-bg-dream {
          background:
            radial-gradient(circle at 84% 12%, rgba(240,228,255,.85), transparent 18%),
            radial-gradient(circle at 16% 80%, rgba(255,236,250,.85), transparent 18%),
            linear-gradient(180deg, rgba(252,249,255,.98), rgba(248,241,255,.98)) !important;
        }

        #pdfPrintArea .page-bg-vintage {
          background:
            linear-gradient(180deg, rgba(252,247,236,.99), rgba(245,235,212,.99)),
            repeating-linear-gradient(0deg, rgba(161,125,75,.06) 0, rgba(161,125,75,.06) 1px, transparent 1px, transparent 28px) !important;
        }

        #pdfPrintArea .page-bg-blossom {
          background:
            radial-gradient(circle at 10% 18%, rgba(255,231,239,.95), transparent 18%),
            radial-gradient(circle at 90% 12%, rgba(229,248,231,.9), transparent 16%),
            radial-gradient(circle at 86% 84%, rgba(255,245,213,.78), transparent 16%),
            linear-gradient(180deg, rgba(255,251,252,.98), rgba(248,255,248,.98)) !important;
        }

        #pdfPrintArea .page-bg-forest {
          background:
            radial-gradient(circle at 14% 10%, rgba(233,247,229,.88), transparent 18%),
            radial-gradient(circle at 86% 16%, rgba(198,232,210,.75), transparent 18%),
            linear-gradient(180deg, rgba(247,252,245,.98), rgba(229,240,228,.98)) !important;
        }

        #pdfPrintArea .page-bg-lilac {
          background:
            radial-gradient(circle at 15% 14%, rgba(246,230,255,.9), transparent 18%),
            radial-gradient(circle at 86% 18%, rgba(226,233,255,.82), transparent 18%),
            linear-gradient(180deg, rgba(252,248,255,.98), rgba(241,236,251,.98)) !important;
        }

        #pdfPrintArea .page-bg-diary {
          background:
            linear-gradient(180deg, rgba(255,251,244,.99), rgba(255,248,239,.99)),
            repeating-linear-gradient(0deg, transparent 0, transparent 30px, rgba(220,176,189,.34) 30px, rgba(220,176,189,.34) 31px),
            linear-gradient(90deg, transparent 0, transparent 42px, rgba(114,166,224,.26) 42px, rgba(114,166,224,.26) 43px) !important;
        }

        #pdfPrintArea .page-number {
          position: absolute !important;
          right: 18mm !important;
          bottom: 12mm !important;
          width: 11mm !important;
          height: 11mm !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          background: rgba(255,255,255,.65) !important;
          color: #8c586c !important;
          font-size: 10pt !important;
          font-weight: 800 !important;
        }

        #pdfPrintArea .cover-kicker {
          letter-spacing: .28em !important;
          text-transform: uppercase !important;
          color: #b87392 !important;
          font-size: 10pt !important;
          margin: 0 !important;
        }

        #pdfPrintArea .cover-author {
          color: #8c6c79 !important;
          font-size: 12pt !important;
          margin: 0 !important;
        }

        #pdfPrintArea .chapter-no {
          display:block !important;
          letter-spacing:.24em !important;
          color:#c07b97 !important;
          font-size:10pt !important;
          font-weight:800 !important;
          margin-bottom: 6pt !important;
        }
      }
    `;

    document.head.appendChild(printStyle);

    const cleanup = () => {
      setTimeout(() => {
        document.getElementById("pdfPrintArea")?.remove();
        document.getElementById("pdfPrintStyle")?.remove();
        window.removeEventListener("afterprint", cleanup);
      }, 300);
    };

    window.addEventListener("afterprint", cleanup);

    setTimeout(() => {
      window.print();
    }, 150);
  }

  function renderReaderFromExtra(id) {
    const els = e();
    const extra = getExtra(id);
    if (!extra || !els.readerContent) return;

    const bg = extra.pageBg || "rose";

    const chapters = (extra.chapters || [])
      .map(
        (ch, idx) =>
          `<section class="preview-page page-bg-${bg}"><div class="chapter-head"><h3>${escapeHtml(ch.title || `Chương ${idx + 1}`)}</h3></div><div class="chapter-body">${ch.html || "<p>Chưa có nội dung.</p>"}</div></section>`,
      )
      .join("");

    els.readerContent.innerHTML = `${
      extra.cover
        ? `<img class="preview-cover" src="${extra.cover}" alt="Bìa truyện" />`
        : ""
    }${chapters}`;
  }

  function enhanceStoryLists() {
    const extras = getExtras();

    $$("[data-read], [data-edit]").forEach((btn) => {
      const card = btn.closest(".story-card, .story-row");
      const id = btn.dataset.read || btn.dataset.edit;
      if (!card || !id) return;

      const extra = extras[id];

      let meta = card.querySelector(".story-extra-meta");
      if (!meta) {
        meta = document.createElement("div");
        meta.className = "story-extra-meta";
        const p = card.querySelector("p");
        if (p) p.insertAdjacentElement("afterend", meta);
      }

      const parts = [];

      if (extra?.cover) {
        parts.push('<span class="story-extra-pill">Có bìa</span>');
      }

      if (extra?.chapters?.length) {
        parts.push(
          `<span class="story-extra-pill">${extra.chapters.length} chương</span>`,
        );
      }

      if (extra?.pageBg) {
        parts.push(`<span class="story-extra-pill">Nền ${extra.pageBg}</span>`);
      }

      meta.innerHTML = parts.join("");
    });
  }

  function activeInlineCss() {
    const p = prefs();
    return [
      `font-family:${fontMap[p.fontFamily] || fontMap.literata || fontMap.serif}`,
      `font-size:${p.fontSize}px`,
      `line-height:${p.lineHeight}`,
      `font-weight:${p.bold ? "700" : "400"}`,
      `font-style:${p.italic ? "italic" : "normal"}`,
      `text-decoration:${p.underline ? "underline" : "none"}`,
      `white-space:pre-wrap`,
    ].join(";");
  }

  function selectionInsideEditor() {
    const els = e();
    const sel = window.getSelection();
    if (!els.richEditor || !sel || !sel.rangeCount) return false;
    return els.richEditor.contains(sel.anchorNode);
  }

  function applyInlineStyleToSelection() {
    const els = e();
    const sel = window.getSelection();

    if (
      !els.richEditor ||
      !sel ||
      !sel.rangeCount ||
      sel.isCollapsed ||
      !selectionInsideEditor()
    ) {
      return false;
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.setAttribute("style", activeInlineCss());

    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }

    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    nextRange.collapse(false);

    sel.removeAllRanges();
    sel.addRange(nextRange);

    saveCurrentChapter();
    return true;
  }

  function setWritingStyle(part) {
    savePrefs(part);
    applyPrefs();
    applyInlineStyleToSelection();
  }

  function toggleWritingStyle(key) {
    const p = prefs();
    setWritingStyle({ [key]: !p[key] });
  }

  function bind() {
    const els = e();

    els.pickCoverBtn?.addEventListener("click", () => els.coverInput?.click());

    els.coverInput?.addEventListener("change", () => {
      const file = els.coverInput.files?.[0];
      if (!file) return;

      const fr = new FileReader();
      fr.onload = () => {
        setCover(String(fr.result || ""));
        persistExtra();
      };

      fr.readAsDataURL(file);
    });

    els.clearCoverBtn?.addEventListener("click", () => {
      if (els.coverInput) els.coverInput.value = "";
      setCover("");
      persistExtra();
    });

    els.addChapterBtn?.addEventListener("click", addChapter);

    els.chapterList?.addEventListener("click", (ev) => {
      const rename = ev.target.closest("[data-rename]")?.dataset.rename;
      const del = ev.target.closest("[data-delete]")?.dataset.delete;
      const chap = ev.target.closest("[data-chapter]")?.dataset.chapter;

      if (rename) return renameChapter(rename);
      if (del) return deleteChapter(del);
      if (chap) activateChapter(chap);
    });

    /*
      FIX DẤU CÁCH:
      Không chặn beforeinput nữa.
      Để trình duyệt tự gõ chữ, tự xử lý dấu cách, tiếng Việt, IME.
    */
    els.richEditor?.addEventListener("input", saveCurrentChapter);

    /*
      Toolbar dùng lệnh native của trình duyệt.
      B / I / U / căn trái / giữa / phải / đều ổn định hơn.
    */
    $$("[data-exec]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const cmd = btn.dataset.exec;
        els.richEditor?.focus();
        document.execCommand(cmd, false, null);
        saveCurrentChapter();
      }),
    );

    $("#insertParagraphBtn")?.addEventListener("click", () => {
      els.richEditor?.focus();
      document.execCommand("insertParagraph", false, null);
      saveCurrentChapter();
    });

    $("#insertIndentBtn")?.addEventListener("click", () => {
      els.richEditor?.focus();
      document.execCommand("insertHTML", false, "&emsp;&emsp;");
      saveCurrentChapter();
    });

    els.editorSizeSelect?.addEventListener("change", () => {
      savePrefs({ fontSize: els.editorSizeSelect.value });
      applyPrefs();
      applyInlineStyleToSelection();
    });

    els.editorLineHeightSelect?.addEventListener("change", () => {
      savePrefs({ lineHeight: els.editorLineHeightSelect.value });
      applyPrefs();
      applyInlineStyleToSelection();
    });

    els.editorFontFamilySelect?.addEventListener("change", () => {
      savePrefs({ fontFamily: els.editorFontFamilySelect.value });
      applyPrefs();
      applyInlineStyleToSelection();
    });

    els.pageBgSelect?.addEventListener("change", () => {
      state.pageBg = els.pageBgSelect.value;
      savePrefs({ pageBg: state.pageBg });
      applyPrefs();
      persistExtra();
    });

    els.openPreviewBtn?.addEventListener("click", openPreview);
    els.exportPdfBtn?.addEventListener("click", exportPdf);
    els.previewPdfBtn?.addEventListener("click", exportPdf);
    els.closePreviewBtn?.addEventListener("click", () =>
      els.previewDialog?.close(),
    );

    const handleSave = () => {
      const beforeIds = new Set(readStories().map((s) => s.id));
      persistExtra({ beforeIds });
      setTimeout(() => persistExtra({ beforeIds }), 180);
    };

    els.saveDraftBtn?.addEventListener("click", handleSave);
    els.publishBtn?.addEventListener("click", handleSave);

    els.newStoryBtn?.addEventListener("click", () => {
      setTimeout(() => {
        freshStoryState();
      }, 80);
    });

    els.deleteStoryBtn?.addEventListener("click", () => {
      const removeId = state.storyId;

      setTimeout(() => {
        if (!removeId) return;

        const extras = getExtras();
        delete extras[removeId];
        saveExtras(extras);
        freshStoryState();
        enhanceStoryLists();
      }, 150);
    });

    document.addEventListener(
      "click",
      (ev) => {
        const readId = ev.target.closest("[data-read]")?.dataset.read;
        const editId = ev.target.closest("[data-edit]")?.dataset.edit;
        const route = ev.target.closest("[data-route]")?.dataset.route;

        if (readId) {
          setTimeout(() => renderReaderFromExtra(readId), 120);
        }

        if (editId) {
          setTimeout(() => loadExtra(editId), 120);
        }

        if (route === "editor" && !editId) {
          setTimeout(() => {
            const els = e();

            const hasAnyInput =
              (els.titleInput?.value || "").trim() ||
              (els.authorInput?.value || "").trim() ||
              (els.contentInput?.value || "").trim() ||
              normalizeText(els.richEditor?.innerHTML || "");

            /*
              Chỉ tạo editor mới khi form thật sự trống.
              Không tự tạo trạng thái mới khi reload/quay lại trang.
            */
            if (!hasAnyInput) {
              freshStoryState();
            }
          }, 110);
        }

        if (["home", "drafts", "published"].includes(route || "")) {
          setTimeout(enhanceStoryLists, 180);
        }
      },
      true,
    );
  }

  function init() {
    moveSearch();
    state.pageBg = prefs().pageBg || "rose";

    /*
      FIX RELOAD TỰ THÊM BẢN NHÁP:
      Không dispatch input trong lúc init.
      Vẫn dựng editor trống để UI hoạt động bình thường,
      nhưng không báo cho app chính rằng user vừa viết.
    */
    suppressStorySync = true;
    applyPrefs();
    bind();
    freshStoryState();
    suppressStorySync = false;

    enhanceStoryLists();
    setTimeout(enhanceStoryLists, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
