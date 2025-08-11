(() => {
  const TWEET_SELECTOR = "article[data-testid='tweet'], article[role='article']";
  const BUTTON_CLASS = "xtb-button";
  const PROCESSED_ATTR = "data-xtb-has-button";
  const POPOVER_ID = "xtb-popover";

  

  let popoverEl = null;
  let lastAnchorEl = null;
  function closePopover() {
    if (!popoverEl) return;
    popoverEl.style.display = 'none';
    popoverEl.setAttribute('aria-hidden', 'true');
    
    // Hide backdrop
    const backdrop = document.getElementById('xtb-backdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
    }
  }
  function ensurePopover() {
    if (popoverEl && document.body.contains(popoverEl)) return popoverEl;
    
    // Create backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "xtb-backdrop";
    backdrop.id = "xtb-backdrop";
    
    popoverEl = document.createElement("div");
    popoverEl.id = POPOVER_ID;
    popoverEl.className = "xtb-popover";
    popoverEl.setAttribute("role", "dialog");
    popoverEl.innerHTML = `
      <div class="xtb-popover__header">
        <span class="xtb-popover__title">Create GitHub issue</span>
        <button type="button" class="xtb-popover__close" aria-label="Close">✕</button>
      </div>
      <div class="xtb-popover__form">
        <label class="xtb-field">
          <span class="xtb-field__label">GitHub repository</span>
          <input type="text" class="xtb-field__input" data-github-input placeholder="owner/repo" inputmode="latin" autocapitalize="off" autocomplete="off" spellcheck="false" />
        </label>
        
        <div class="xtb-section" style="margin-top: 24px;">
          <h3 class="xtb-section__title">AI (optional)</h3>
          <label class="xtb-field" style="margin-top: 16px;">
            <span class="xtb-field__label">OpenRouter API key</span>
            <input type="password" class="xtb-field__input" data-or-key placeholder="sk-or-..." />
          </label>
          <div class="xtb-ai-fields" style="display: none;">
            <div class="xtb-toggle-header" style="margin-top: 16px;">
              <span class="xtb-toggle-section-label">System prompt for</span>
              <div class="xtb-toggle-section">
                <button type="button" class="xtb-toggle-btn" data-toggle-title>Title</button>
                <button type="button" class="xtb-toggle-btn xtb-toggle-btn--active" data-toggle-content>Content</button>
              </div>
            </div>
            <div class="xtb-toggle-content" data-toggle-title-content style="display: none;">
              <div class="xtb-field">
                <div class="xtb-field__header">
                  <div class="xtb-toggle-group">
                    <span class="xtb-toggle-label">Use AI</span>
                    <div class="xtb-toggle-switch">
                      <input type="checkbox" id="title-ai-toggle" data-title-ai-toggle checked />
                      <label for="title-ai-toggle" class="xtb-toggle-switch__label"></label>
                    </div>
                  </div>
                </div>
                <textarea class="xtb-field__input" data-or-system rows="3" placeholder="System prompt for generating issue titles...">Expressive title, less than 80 chars, use prefix "bug:" if it is a bug report</textarea>
              </div>
            </div>
            <div class="xtb-toggle-content" data-toggle-content-content>
              <div class="xtb-field">
                <div class="xtb-field__header">
                  <div class="xtb-toggle-group">
                    <span class="xtb-toggle-label">Use AI</span>
                    <div class="xtb-toggle-switch">
                      <input type="checkbox" id="content-ai-toggle" data-content-ai-toggle checked />
                      <label for="content-ai-toggle" class="xtb-toggle-switch__label"></label>
                    </div>
                  </div>
                </div>
                <textarea class="xtb-field__input" data-or-content rows="5" placeholder="System prompt for formatting issue content...">Directly copy the tweet content into the issue body, format in the following way: user: @username, tweet: tweet content, source: tweet url</textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="xtb-popover__actions">
        <button type="button" class="xtb-popover__create" data-create-issue>Create issue</button>
      </div>
    `;
    // Direct close button binding
    const closeBtn = popoverEl.querySelector('.xtb-popover__close');
    if (closeBtn instanceof HTMLElement) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
      }, true);
    }
    // Persist GitHub repo input
    const ghInput = popoverEl.querySelector('[data-github-input]');
    if (ghInput instanceof HTMLInputElement) {
      ghInput.addEventListener('input', () => {
        try { localStorage.setItem('xtb:githubRepo', ghInput.value.trim()); } catch (_) {}
      });
    }
    // Load OpenRouter settings
    const orKeyInput = popoverEl.querySelector('[data-or-key]');
    const orSysInput = popoverEl.querySelector('[data-or-system]');
    const orContentInput = popoverEl.querySelector('[data-or-content]');
    const aiFields = popoverEl.querySelector('.xtb-ai-fields');
    
    loadOpenRouterSettings().then((cfg) => {
      if (orKeyInput instanceof HTMLInputElement && !orKeyInput.value) orKeyInput.value = cfg.key || '';
      if (orSysInput instanceof HTMLTextAreaElement && !orSysInput.value) orSysInput.value = cfg.system || '';
      if (orContentInput instanceof HTMLTextAreaElement && !orContentInput.value) orContentInput.value = cfg.content || '';
      if (titleAiToggle) titleAiToggle.checked = cfg.titleAiEnabled;
      if (contentAiToggle) contentAiToggle.checked = cfg.contentAiEnabled;
      updateAiFieldsVisibility();
      updateTextareaStates();
    }).catch(() => {});
    
    const saveOrDebounced = debounce(() => {
      const key = orKeyInput instanceof HTMLInputElement ? orKeyInput.value.trim() : '';
      const system = orSysInput instanceof HTMLTextAreaElement ? orSysInput.value.trim() : '';
      const content = orContentInput instanceof HTMLTextAreaElement ? orContentInput.value.trim() : '';
      const titleAiEnabled = titleAiToggle ? titleAiToggle.checked : true;
      const contentAiEnabled = contentAiToggle ? contentAiToggle.checked : true;
      saveOpenRouterSettings({ key, system, content, titleAiEnabled, contentAiEnabled });
    }, 400);
    
    if (orKeyInput) {
      orKeyInput.addEventListener('input', () => {
        updateAiFieldsVisibility();
        saveOrDebounced();
      });
    }
    if (orSysInput) orSysInput.addEventListener('input', saveOrDebounced);
    if (orContentInput) orContentInput.addEventListener('input', saveOrDebounced);
    
    // Toggle functionality for system prompts
    const toggleTitleBtn = popoverEl.querySelector('[data-toggle-title]');
    const toggleContentBtn = popoverEl.querySelector('[data-toggle-content]');
    const titleContent = popoverEl.querySelector('[data-toggle-title-content]');
    const contentContent = popoverEl.querySelector('[data-toggle-content-content]');
    
    if (toggleTitleBtn && toggleContentBtn && titleContent && contentContent) {
      toggleTitleBtn.addEventListener('click', () => {
        toggleTitleBtn.classList.add('xtb-toggle-btn--active');
        toggleContentBtn.classList.remove('xtb-toggle-btn--active');
        titleContent.style.display = 'block';
        contentContent.style.display = 'none';
      });
      
      toggleContentBtn.addEventListener('click', () => {
        toggleContentBtn.classList.add('xtb-toggle-btn--active');
        toggleTitleBtn.classList.remove('xtb-toggle-btn--active');
        contentContent.style.display = 'block';
        titleContent.style.display = 'none';
      });
    }
    
    // On/off toggle functionality for AI vs verbatim
    const titleAiToggle = popoverEl.querySelector('[data-title-ai-toggle]');
    const contentAiToggle = popoverEl.querySelector('[data-content-ai-toggle]');
    
    if (titleAiToggle && contentAiToggle) {
      titleAiToggle.addEventListener('change', () => {
        updateTextareaStates();
        saveOrDebounced();
      });
      contentAiToggle.addEventListener('change', () => {
        updateTextareaStates();
        saveOrDebounced();
      });
    }
    
    function updateTextareaStates() {
      if (orSysInput) {
        orSysInput.disabled = !titleAiToggle.checked;
        orSysInput.style.opacity = titleAiToggle.checked ? '1' : '0.5';
      }
      if (orContentInput) {
        orContentInput.disabled = !contentAiToggle.checked;
        orContentInput.style.opacity = contentAiToggle.checked ? '1' : '0.5';
      }
    }
    
    function updateAiFieldsVisibility() {
      if (aiFields && orKeyInput instanceof HTMLInputElement) {
        const hasKey = orKeyInput.value.trim().length > 0;
        aiFields.style.display = hasKey ? 'block' : 'none';
        
        // Gray out fields when no key
        const fields = aiFields.querySelectorAll('.xtb-field__input');
        fields.forEach(field => {
          field.style.opacity = hasKey ? '1' : '0.5';
          field.disabled = !hasKey;
        });
      }
    }

    // Global handlers: Escape, outside click
    if (!document.__xtbPopoverBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePopover();
      });
      document.addEventListener('mousedown', (e) => {
        if (!popoverEl) return;
        const target = e.target;
        if (!(target instanceof Node)) return;
        const isInside = popoverEl.contains(target);
        const isOnAnchor = lastAnchorEl instanceof HTMLElement && lastAnchorEl.contains(target);
        const isVisible = popoverEl.style.display !== 'none';
        if (isVisible && !isInside && !isOnAnchor) closePopover();
      });
      // flag to avoid duplicate bindings
      Object.defineProperty(document, '__xtbPopoverBound', { value: true, configurable: false, enumerable: false, writable: false });
    }
    
    // Append backdrop first, then popover
    document.body.appendChild(backdrop);
    document.body.appendChild(popoverEl);
    return popoverEl;
  }

  function showTweetPopover(anchorElement, article, url) {
    const pop = ensurePopover();
    
    // Show backdrop
    const backdrop = document.getElementById('xtb-backdrop');
    if (backdrop) {
      backdrop.style.display = 'block';
    }
    
    pop.style.display = 'block';
    pop.removeAttribute('aria-hidden');
    // Wire up Create issue button to this article
    const createBtn = pop.querySelector('[data-create-issue]');
    if (createBtn instanceof HTMLElement) {
      createBtn.onclick = async () => {
        const ghInput = pop.querySelector('[data-github-input]');
        const repo = ghInput instanceof HTMLInputElement ? ghInput.value.trim() : '';
        if (!/^[-\w.]+\/[.-\w]+$/.test(repo)) {
          showToast(createBtn, 'Enter owner/repo');
          return;
        }
        const issueUrl = await buildIssueUrl(repo, article);
        window.open(issueUrl, '_blank', 'noopener');
        closePopover();
      };
    }
    const ghInput = pop.querySelector('[data-github-input]');
    if (ghInput instanceof HTMLInputElement) {
      try {
        const saved = localStorage.getItem('xtb:githubRepo') || '';
        if (!ghInput.value) ghInput.value = saved;
      } catch (_) {}
      // Slight defer to ensure layout is set before focus
      setTimeout(() => { ghInput.focus({ preventScroll: true }); }, 0);
    }

    // Center popup on screen
    try {
      const maxWidth = Math.min(520, Math.max(280, Math.floor(window.innerWidth * 0.92)));
      pop.style.width = `${maxWidth}px`;
      
      // Center horizontally
      const left = (window.innerWidth - maxWidth) / 2;
      
      // Center vertically with some offset from top
      const top = Math.max(16, (window.innerHeight - 520) / 2);
      
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
      lastAnchorEl = anchorElement;
    } catch (_) {}
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

  function getTweetTextWithEmojis(article) {
    const root = findTweetTextContainer(article);
    if (!root) return "";
    let result = "";
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.nodeValue || "";
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (el.tagName === 'IMG') {
          const alt = el.getAttribute('alt');
          if (alt) {
            result += alt; // twemoji images carry emoji in alt
            return;
          }
        }
        // Line breaks for certain elements to keep readability
        if (el.tagName === 'BR' || el.tagName === 'P' || el.tagName === 'DIV') {
          if (result && !result.endsWith('\n')) result += '\n';
        }
        el.childNodes.forEach(walk);
        return;
      }
    };
    walk(root);
    // Normalize whitespace: collapse >2 newlines, trim
    return result.replace(/[\t\r]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function getTweetUsername(article) {
    // Try multiple selectors to find username
    const selectors = [
      'div[data-testid="User-Name"] a[href^="/"]',
      'a[href^="/"][role="link"] span',
      '[data-testid="User-Names"] a[href^="/"]'
    ];
    
    for (const selector of selectors) {
      const elements = article.querySelectorAll(selector);
      for (const element of elements) {
        const href = element.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
          const username = href.slice(1); // Remove leading slash
          if (username && !username.includes('/')) {
            return `@${username}`;
          }
        }
      }
    }
    
    // Fallback: try to extract from URL if available
    const tweetUrl = extractTweetUrl(article);
    if (tweetUrl) {
      try {
        const url = new URL(tweetUrl);
        const pathParts = url.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1]) {
          return `@${pathParts[1]}`;
        }
      } catch (_) {}
    }
    
    return '';
  }

  function upgradeTwitterImageUrl(url) {
    try {
      const u = new URL(url, window.location.origin);
      if (u.hostname.endsWith('pbs.twimg.com') && u.pathname.startsWith('/media/')) {
        // Force larger image variant for readability
        u.searchParams.set('name', 'large');
        return u.toString();
      }
    } catch (_) {}
    return url;
  }

  function collectTweetImageUrls(article) {
    const imageSrcs = new Set();
    const urls = [];
    const selectors = [
      "div[data-testid='tweetPhoto'] img",
      "img[src*='pbs.twimg.com/media/']",
      // Some builds lazy-load via srcset; pick best candidate if present
      "div[data-testid='tweetPhoto'] img[srcset]",
    ];
    selectors.forEach((sel) => {
      article.querySelectorAll(sel).forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        let src = img.currentSrc || img.src || img.getAttribute('src') || '';
        if (!src) return;
        if (/profile_images\//.test(src)) return; // skip avatars
        if (imageSrcs.has(src)) return;
        imageSrcs.add(src);
        urls.push(upgradeTwitterImageUrl(src));
      });
    });
    return urls;
  }

  async function buildIssueUrl(repo, article) {
    const base = `https://github.com/${repo}/issues/new`;
    const tweetUrl = extractTweetUrl(article) || window.location.href;
    const text = getTweetTextWithEmojis(article);
    const username = getTweetUsername(article);
    const title = await deriveTitle(text, tweetUrl, username);
    const content = await deriveContent(text, tweetUrl, username);
    const imgUrls = collectTweetImageUrls(article);
    
    // Use AI-generated content if available, otherwise fallback to original format
    let body;
    if (content && content !== text) {
      // AI processed content
      body = content;
      if (imgUrls.length > 0) {
        body += "\n\n";
        imgUrls.forEach((u, i) => {
          body += `![tweet image ${i + 1}](${u})\n`;
        });
      }
    } else {
      // Original format
      const bodyParts = [];
      if (text) bodyParts.push(text);
      if (imgUrls.length > 0) {
        bodyParts.push("");
        imgUrls.forEach((u, i) => {
          bodyParts.push(`![tweet image ${i + 1}](${u})`);
        });
      }
      bodyParts.push("", `Source: ${tweetUrl}`);
      body = bodyParts.join("\n");
    }
    
    const params = new URLSearchParams();
    params.set('title', title);
    params.set('body', body);
    return `${base}?${params.toString()}`;
  }

  function chromeSyncAvailable() {
    return typeof chrome !== 'undefined' && chrome?.storage?.sync;
  }
  function loadOgKeyFromStorage() {
    return new Promise((resolve, reject) => {
      if (!chromeSyncAvailable()) return resolve('');
      try {
        chrome.storage.sync.get({ xtbOgApiKey: '' }, (data) => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(err);
          resolve(data?.xtbOgApiKey || '');
        });
      } catch (e) {
        resolve('');
      }
    });
  }
  function saveOgKeyToStorage(value) {
    return new Promise((resolve) => {
      if (!chromeSyncAvailable()) return resolve();
      try {
        chrome.storage.sync.set({ xtbOgApiKey: value || '' }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }
  function loadOpenRouterSettings() {
    return new Promise((resolve) => {
      if (!chromeSyncAvailable()) return resolve({ key: '', system: '', content: '', titleAiEnabled: true, contentAiEnabled: true });
      try {
        chrome.storage.sync.get({ 
          xtbOpenRouterKey: '', 
          xtbOpenRouterSystem: '', 
          xtbOpenRouterContent: '', 
          xtbTitleAiEnabled: true, 
          xtbContentAiEnabled: true 
        }, (data) => {
          resolve({ 
            key: data?.xtbOpenRouterKey || '', 
            system: data?.xtbOpenRouterSystem || '', 
            content: data?.xtbOpenRouterContent || '',
            titleAiEnabled: data?.xtbTitleAiEnabled !== false,
            contentAiEnabled: data?.xtbContentAiEnabled !== false
          });
        });
      } catch (_) {
        resolve({ key: '', system: '', content: '', titleAiEnabled: true, contentAiEnabled: true });
      }
    });
  }
  function saveOpenRouterSettings({ key, system, content, titleAiEnabled, contentAiEnabled }) {
    return new Promise((resolve) => {
      if (!chromeSyncAvailable()) return resolve();
      try {
        chrome.storage.sync.set({ 
          xtbOpenRouterKey: key || '', 
          xtbOpenRouterSystem: system || '', 
          xtbOpenRouterContent: content || '',
          xtbTitleAiEnabled: titleAiEnabled !== false,
          xtbContentAiEnabled: contentAiEnabled !== false
        }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }
  function debounce(fn, wait) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  async function getStoredOpenGraphKey() {
    try { return await loadOgKeyFromStorage(); } catch (_) { return ''; }
  }
  async function getStoredOpenRouter() {
    try { return await loadOpenRouterSettings(); } catch (_) { return { key: '', system: '', content: '', titleAiEnabled: true, contentAiEnabled: true }; }
  }

  async function deriveTitle(text, tweetUrl, username) {
    const fallback = (() => {
      if (!text) return `Tweet reference`;
      const chars = Array.from(text);
      return chars.length > 80 ? chars.slice(0, 80).join("") : text;
    })();

    // 1) Try OpenRouter
    try {
      const { key, system, titleAiEnabled } = await getStoredOpenRouter();
      if (key && titleAiEnabled) {
        const userInfo = username ? `User: ${username}\n` : '';
        const prompt = `${userInfo}Tweet: ${text}\nLink: ${tweetUrl}\n\nReturn only an issue title (<=80 chars).`;
        const sys = system && system.trim().length > 0
          ? system.trim()
          : 'You are a helpful assistant that writes concise, actionable GitHub issue titles based on tweets. Keep it under 80 characters, no trailing punctuation.';
        const title = await fetchOpenRouterTitle(key, sys, prompt);
        if (title) {
          const chars = Array.from(title);
          return chars.length > 80 ? chars.slice(0, 80).join("") : title;
        }
      }
    } catch (_) { /* fall through */ }

    // 2) Try OpenGraph as backup
    try {
      const apiKey = await getStoredOpenGraphKey();
      if (apiKey) {
        const endpoint = `https://opengraph.io/api/1.1/site/${encodeURIComponent(tweetUrl)}`;
        const url = `${endpoint}?app_id=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, { method: 'GET', credentials: 'omit' });
        if (res.ok) {
          const data = await res.json();
          const ogTitle = data?.openGraph?.title || data?.hybridGraph?.title || '';
          if (ogTitle) {
            const chars = Array.from(ogTitle);
            return chars.length > 80 ? chars.slice(0, 80).join("") : ogTitle;
          }
        }
      }
    } catch (_) { /* fall through */ }

    // 3) Fallback: tweet text
    return fallback;
  }

  async function fetchOpenRouterTitle(apiKey, systemPrompt, userPrompt) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 120,
          temperature: 0.2,
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      // Take first line, trim, remove quotes
      const firstLine = String(content).split('\n')[0].trim().replace(/^"|"$/g, '');
      return firstLine;
    } catch (_) {
      return '';
    }
  }

  async function fetchOpenRouterContent(apiKey, systemPrompt, userPrompt) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.2,
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return content.trim();
    } catch (_) {
      return '';
    }
  }

  async function deriveContent(text, tweetUrl, username) {
    // Fallback: return original text
    const fallback = text;

    // Try OpenRouter for content processing
    try {
      const { key, content: contentSystemPrompt, contentAiEnabled } = await getStoredOpenRouter();
      if (key && contentAiEnabled && contentSystemPrompt && contentSystemPrompt.trim().length > 0) {
        const userInfo = username ? `User: ${username}\n` : '';
        const prompt = `${userInfo}Tweet: ${text}\nLink: ${tweetUrl}\n\nFormat this tweet content according to the instructions.`;
        const content = await fetchOpenRouterContent(key, contentSystemPrompt.trim(), prompt);
        if (content) {
          return content;
        }
      }
    } catch (_) { /* fall through */ }

    // Return fallback
    return fallback;
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
    // from Phosphor Icon under MIT license: https://phosphoricons.com/
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="156" cy="92" r="12" fill="currentColor" /><circle cx="100" cy="92" r="12" fill="currentColor" /><line x1="128" y1="128" x2="128" y2="224" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M208,144a80,80,0,0,1-160,0V112a80,80,0,0,1,160,0Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="232" y1="184" x2="203.18" y2="171.41" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="232" y1="72" x2="203.18" y2="84.59" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="24" y1="72" x2="52.82" y2="84.59" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="24" y1="184" x2="52.82" y2="171.41" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="16" y1="128" x2="240" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>'
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


