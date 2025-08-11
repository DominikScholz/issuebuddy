(() => {
  const TWEET_SELECTOR = "article[data-testid='tweet'], article[role='article']";
  const BUTTON_CLASS = "xtb-button";
  const PROCESSED_ATTR = "data-xtb-has-button";
  const POPOVER_ID = "xtb-popover";

  

  let popoverEl = null;
  function ensurePopover() {
    if (popoverEl && document.body.contains(popoverEl)) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.id = POPOVER_ID;
    popoverEl.className = "xtb-popover";
    popoverEl.setAttribute("popover", "auto");
    popoverEl.innerHTML = `
      <div class="xtb-popover__header">
        <span class="xtb-popover__title">Tweet preview</span>
        <button type="button" class="xtb-popover__close" aria-label="Close">✕</button>
      </div>
      <div class="xtb-popover__content">
        <div class="xtb-popover__body" data-body></div>
      </div>
      <div class="xtb-popover__footer">
        <a class="xtb-popover__link" data-link target="_blank" rel="noopener noreferrer">Open tweet ↗</a>
      </div>
    `;
    popoverEl.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains("xtb-popover__close")) {
        popoverEl.hidePopover();
        // Best-effort cleanup of anchor props
        popoverEl.style.removeProperty('position-anchor');
        popoverEl.classList.remove('xtb-popover--anchored');
      }
    });
    // Cleanup when closed from outside
    popoverEl.addEventListener('toggle', () => {
      try {
        if (!popoverEl.matches(':popover-open')) {
          popoverEl.style.removeProperty('position-anchor');
          popoverEl.classList.remove('xtb-popover--anchored');
        }
      } catch (_) {}
    });
    document.body.appendChild(popoverEl);
    return popoverEl;
  }

  function showTweetPopover(anchorElement, article, url) {
    const pop = ensurePopover();
    const bodyEl = pop.querySelector('[data-body]');
    const linkEl = pop.querySelector('[data-link]');
    if (bodyEl) {
      bodyEl.innerHTML = "";
      const frag = buildTweetContentFragment(article);
      bodyEl.appendChild(frag);
    }
    if (linkEl) linkEl.setAttribute("href", url || "#");

    // Preferred: CSS anchor positioning (if supported)
    const anchorName = `--xtb-anchor`;
    try {
      anchorElement.style.setProperty('anchor-name', anchorName);
      pop.style.setProperty('position-anchor', anchorName);
      pop.classList.add('xtb-popover--anchored');
    } catch (_) {}

    // Fallback manual positioning
    try {
      const rect = anchorElement.getBoundingClientRect();
      const maxWidth = Math.min(520, Math.max(280, Math.floor(window.innerWidth * 0.92)));
      pop.style.width = `${maxWidth}px`;
      const top = Math.min(
        window.innerHeight - 16,
        rect.bottom + 8
      );
      let left = rect.left + rect.width / 2 - maxWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - maxWidth - 8));
      pop.style.top = `${Math.max(8, top)}px`;
      pop.style.left = `${left}px`;
    } catch (_) {}

    try {
      pop.showPopover();
    } catch (_) {
      // Fallback for older Chromium that might throw if already open
      pop.hidePopover?.();
      pop.showPopover?.();
    }
  }

  function makeAbsoluteUrl(href) {
    if (!href) return href;
    try {
      return new URL(href, window.location.origin).toString();
    } catch (_) {
      return href;
    }
  }

  function findTweetTextContainer(article) {
    const candidates = article.querySelectorAll("div[data-testid='tweetText'], div[lang], span[lang], p[lang]");
    let best = null;
    let bestLen = 0;
    candidates.forEach((node) => {
      const text = node.innerText ? node.innerText.trim() : "";
      if (!text) return;
      if (node.closest("div[role='group']")) return; // skip toolbars
      const len = text.length;
      if (len > bestLen) {
        best = node;
        bestLen = len;
      }
    });
    return best;
  }

  function cloneTweetTextNode(article) {
    const container = findTweetTextContainer(article);
    if (!container) return null;
    const wrapper = document.createElement("div");
    wrapper.className = "xtb-popover__text";
    const cloned = container.cloneNode(true);
    wrapper.appendChild(cloned);
    // Normalize links and images
    wrapper.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('href', makeAbsoluteUrl(a.getAttribute('href') || '#'));
    });
    wrapper.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      if (src) img.setAttribute('src', makeAbsoluteUrl(src));
      img.decoding = 'async';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.style.verticalAlign = 'text-bottom';
    });
    return wrapper;
  }

  function collectTweetImagesNode(article) {
    const imageSrcs = new Set();
    const imageEls = [];
    const selectors = [
      "div[data-testid='tweetPhoto'] img",
      "img[src*='pbs.twimg.com/media/']",
    ];
    selectors.forEach((sel) => {
      article.querySelectorAll(sel).forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) return;
        // Filter out avatars and emojis
        if (/profile_images\//.test(src)) return;
        if (imageSrcs.has(src)) return;
        imageSrcs.add(src);
        imageEls.push(src);
      });
    });
    if (imageEls.length === 0) return null;
    const wrap = document.createElement('div');
    wrap.className = 'xtb-popover__media';
    imageEls.forEach((src) => {
      const im = document.createElement('img');
      im.className = 'xtb-popover__image';
      im.decoding = 'async';
      im.loading = 'lazy';
      im.src = src;
      wrap.appendChild(im);
    });
    return wrap;
  }

  function collectCardLinkNode(article) {
    const cardAnchor = article.querySelector("[data-testid='card.wrapper'] a[href]");
    if (!cardAnchor) return null;
    const href = makeAbsoluteUrl(cardAnchor.getAttribute('href') || '#');
    const link = document.createElement('a');
    link.className = 'xtb-popover__cardlink';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = cardAnchor.innerText?.trim() || href;
    const wrap = document.createElement('div');
    wrap.className = 'xtb-popover__card';
    wrap.appendChild(link);
    return wrap;
  }

  function buildTweetContentFragment(article) {
    const frag = document.createDocumentFragment();
    const textNode = cloneTweetTextNode(article);
    const mediaNode = collectTweetImagesNode(article);
    const cardNode = collectCardLinkNode(article);
    if (textNode) frag.appendChild(textNode);
    if (mediaNode) frag.appendChild(mediaNode);
    if (cardNode) frag.appendChild(cardNode);
    if (!textNode && !mediaNode && !cardNode) {
      const empty = document.createElement('div');
      empty.className = 'xtb-popover__text';
      empty.textContent = 'No content';
      frag.appendChild(empty);
    }
    return frag;
  }

  function createButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "Preview";
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

  function findTimestampContainer(article) {
    // Common structure: a time tag inside an anchor that links to /status/
    const time = article.querySelector("a[href*='/status/'] time");
    if (time && time.parentElement) {
      // Use the anchor's parent container to place an inline button nearby
      return time.parentElement.parentElement || time.parentElement;
    }
    // Fallback to any anchor with /status/
    const anchor = article.querySelector("a[href*='/status/']");
    return anchor ? anchor.parentElement : null;
  }

  function ensureFabContainer(article) {
    let holder = article.querySelector(":scope > .xtb-fab");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "xtb-fab";
      article.classList.add("xtb-host-relative");
      article.appendChild(holder);
    }
    return holder;
  }

  function injectIntoArticle(article) {
    if (article.getAttribute(PROCESSED_ATTR) === "1") {
      return;
    }

    try {
      let targetContainer = findActionBar(article);
      if (!targetContainer) {
        targetContainer = findTimestampContainer(article);
      }
      if (!targetContainer) {
        targetContainer = ensureFabContainer(article);
      }

      const button = createButton(() => {
        const url = extractTweetUrl(article) || window.location.href;
        showTweetPopover(button, article, url);
      });

      targetContainer.appendChild(button);
      article.setAttribute(PROCESSED_ATTR, "1");
    } catch (err) {
      // swallow
    }
  }

  function scanAndInject(root = document) {
    const articles = root.querySelectorAll(TWEET_SELECTOR);
    for (const article of articles) {
      injectIntoArticle(article);
    }
  }

  // Initial scan
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


