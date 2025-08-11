(() => {
  const DEBUG = true; // flip to false to disable HUD/logging
  const LOG_PREFIX = "[xtb]";
  const TWEET_SELECTOR = "article[data-testid='tweet'], article[role='article']";
  const BUTTON_CLASS = "xtb-button";
  const PROCESSED_ATTR = "data-xtb-has-button";
  const DEBUG_INJECTED = "xtb-debug-injected";
  const DEBUG_MISS_ACTION = "xtb-debug-miss-action";

  const stats = {
    scanned: 0,
    injected: 0,
    already: 0,
    noActionBar: 0,
    errors: 0,
  };

  function log(...args) {
    if (!DEBUG) return;
    // eslint-disable-next-line no-console
    console.log(LOG_PREFIX, ...args);
  }

  let hudEl = null;
  function ensureHud() {
    if (!DEBUG || hudEl) return;
    hudEl = document.createElement("div");
    hudEl.className = "xtb-debug-hud";
    hudEl.innerHTML = `
      <div class="xtb-debug-hud__row">
        <strong>XTB</strong>
        <button type="button" data-action="rescan">Rescan</button>
        <button type="button" data-action="hide">Hide</button>
      </div>
      <div class="xtb-debug-hud__row" data-kv></div>
    `;
    hudEl.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      if (action === "rescan") {
        scanAndInject();
        updateHud();
      }
      if (action === "hide") {
        hudEl.style.display = "none";
      }
    });
    document.documentElement.appendChild(hudEl);
    updateHud();
  }

  function updateHud() {
    if (!DEBUG || !hudEl) return;
    const kv = hudEl.querySelector('[data-kv]');
    if (!kv) return;
    kv.textContent = `scanned: ${stats.scanned} | injected: ${stats.injected} | already: ${stats.already} | noActionBar: ${stats.noActionBar} | errors: ${stats.errors}`;
  }

  function createButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "Copy Link";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      onClick(event);
    });
    return button;
  }

  function showToast(anchorElement, message) {
    const toast = document.createElement("div");
    toast.className = "xtb-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    const rect = anchorElement.getBoundingClientRect();
    const top = window.scrollY + rect.top - 36;
    const left = window.scrollX + rect.left + rect.width / 2;
    toast.style.top = `${Math.max(top, 8)}px`;
    toast.style.left = `${Math.max(left, 8)}px`;

    requestAnimationFrame(() => {
      toast.classList.add("xtb-toast--visible");
    });

    setTimeout(() => {
      toast.classList.remove("xtb-toast--visible");
      setTimeout(() => toast.remove(), 200);
    }, 1200);
  }

  function extractTweetUrl(article) {
    const anchor = article.querySelector("a[href*='/status/'][role='link']") ||
      article.querySelector("a[href*='/status/']");
    if (!anchor) return null;
    const href = anchor.getAttribute("href");
    if (!href) return null;
    try {
      const url = new URL(href, window.location.origin);
      return url.toString();
    } catch (e) {
      return null;
    }
  }

  function findActionBar(article) {
    const groups = article.querySelectorAll("div[role='group']");
    for (const group of groups) {
      if (
        group.querySelector("div[data-testid='like']") ||
        group.querySelector("div[data-testid='reply']") ||
        group.querySelector("div[data-testid='retweet']") ||
        group.querySelector("svg[aria-label='Like']")
      ) {
        return group;
      }
    }
    // Fallback: last group within article (toolbar-like in most builds)
    if (groups.length > 0) return groups[groups.length - 1];
    return null;
  }

  function injectIntoArticle(article) {
    stats.scanned += 1;
    if (article.getAttribute(PROCESSED_ATTR) === "1") {
      stats.already += 1;
      return;
    }

    try {
      const actionBar = findActionBar(article);
      if (!actionBar) {
        stats.noActionBar += 1;
        if (DEBUG) article.classList.add(DEBUG_MISS_ACTION);
        return;
      }

      const button = createButton(() => {
        const url = extractTweetUrl(article);
        if (url) {
          navigator.clipboard.writeText(url).then(
            () => showToast(button, "Copied!"),
            () => {
              window.prompt("Copy tweet URL:", url);
            }
          );
        }
      });

      actionBar.appendChild(button);
      article.setAttribute(PROCESSED_ATTR, "1");
      stats.injected += 1;
      if (DEBUG) article.classList.add(DEBUG_INJECTED);
      log("injected button into tweet", { url: extractTweetUrl(article) });
      updateHud();
    } catch (err) {
      stats.errors += 1;
      updateHud();
      // eslint-disable-next-line no-console
      console.error(LOG_PREFIX, "inject error", err);
    }
  }

  function scanAndInject(root = document) {
    const articles = root.querySelectorAll(TWEET_SELECTOR);
    for (const article of articles) {
      injectIntoArticle(article);
    }
    updateHud();
  }

  // Initial scan
  if (DEBUG) ensureHud();
  log("content script loaded");
  scanAndInject();

  // Observe dynamic page updates
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches && node.matches(TWEET_SELECTOR)) {
          injectIntoArticle(node);
        } else {
          scanAndInject(node);
        }
      }
    }
    updateHud();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Periodic rescans to catch SPA route changes and layout shifts
  let rescanTick = 0;
  setInterval(() => {
    rescanTick += 1;
    // Lighter cadence after initial warmup
    if (rescanTick < 20 || rescanTick % 5 === 0) {
      scanAndInject();
    }
  }, 1500);
})();


