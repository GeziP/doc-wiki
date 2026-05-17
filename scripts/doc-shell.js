/* ===== doc-shell.js — Shared JS for all doc types ===== */
/* Shared interactive features for all doc-writer document types */
(function() {
  'use strict';

  var root = document.documentElement;

  // --- Theme: 3-layer (localStorage > OS preference > default light) ---
  var savedTheme = localStorage.getItem('doc-theme');
  if (savedTheme) {
    root.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-theme', 'dark');
  }

  function currentThemeIsDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  window.toggleTheme = function() {
    var current = root.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('doc-theme', next);
    rerenderMermaid(next === 'dark');
  };

  // --- Mobile sidebar toggle ---
  window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
  };

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar').classList.remove('open');
    }
  }

  // --- TOC auto-generation ---
  function slugify(text) {
    return text.trim().toLowerCase()
      .replace(/[\s]+/g, '-')
      .replace(/[^\w一-鿿-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function buildTOC() {
    var toc = document.getElementById('toc');
    if (!toc) return;

    // Determine TOC container type: <nav> (guide) or <ul.toc-list> (module/system)
    var isNav = toc.tagName === 'NAV';
    var container = isNav ? toc : toc.querySelector('ul') || toc;

    var items = [];

    // Collect H2 from flat sections and collapsible sections
    document.querySelectorAll(
      '.section[id] > .section-title, ' +
      '.section[id] > .section-header h2, ' +
      'details.section-block[id] > summary h2, ' +
      'details[id] > summary h2'
    ).forEach(function(el) {
      var section = el.closest('[id]');
      if (!section) return;
      items.push({ id: section.id, text: el.textContent.trim(), level: 2 });
    });

    // Collect H3 with ids
    document.querySelectorAll('.section[id] h3[id], .section-body h3[id], details.section-block[id] h3[id], details[id] h3[id]').forEach(function(el) {
      items.push({ id: el.id, text: el.textContent.trim(), level: 3 });
    });

    // Auto-generate ids for H3 without ids
    document.querySelectorAll('.section h3:not([id]), .section-body h3:not([id])').forEach(function(el) {
      var id = slugify(el.textContent);
      if (id && !document.getElementById(id)) {
        el.id = id;
        items.push({ id: id, text: el.textContent.trim(), level: 3 });
      }
    });

    // Build HTML
    if (isNav) {
      // Guide-style: flat <a> links
      var html = '';
      items.forEach(function(item) {
        var cls = item.level === 3 ? 'toc-link toc-h3' : 'toc-link';
        html += '<a class="' + cls + '" href="#' + item.id + '">' + item.text + '</a>';
      });
      container.innerHTML = html;
    } else {
      // Module/system-style: <ul><li><a>
      container.innerHTML = '';
      items.forEach(function(item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + item.id;
        a.textContent = item.text;
        if (item.level === 3) a.classList.add('toc-h3');
        a.addEventListener('click', function(e) {
          e.preventDefault();
          var target = document.getElementById(item.id);
          if (target) {
            var details = target.closest('details');
            if (details && !details.open) details.open = true;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          closeSidebarOnMobile();
        });
        li.appendChild(a);
        container.appendChild(li);
      });
    }

    // Close sidebar on mobile after click
    container.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        closeSidebarOnMobile();
      });
    });
  }

  // --- ScrollSpy ---
  function setupScrollSpy() {
    var links = document.querySelectorAll('.toc-link, .toc-list a');
    if (!links.length) return;

    var targets = [];
    links.forEach(function(link) {
      var id = link.getAttribute('href');
      if (!id) return;
      id = id.slice(1);
      var el = document.getElementById(id);
      if (el) targets.push({ el: el, link: link });
    });

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          links.forEach(function(l) { l.classList.remove('active'); });
          var match = targets.find(function(t) { return t.el === entry.target; });
          if (match) match.link.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

    targets.forEach(function(t) { observer.observe(t.el); });
  }

  // --- Code highlighting + copy buttons ---
  function setupCodeBlocks() {
    document.querySelectorAll('.code-block').forEach(function(block) {
      // Inject copy button
      if (!block.querySelector('.copy-btn')) {
        var btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', function() {
          var code = block.querySelector('code');
          if (code && navigator.clipboard) {
            navigator.clipboard.writeText(code.textContent).then(function() {
              btn.textContent = '✓';
              btn.classList.add('copied');
              setTimeout(function() {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
              }, 1500);
            });
          }
        });
        block.appendChild(btn);
      }

      // Inject language tag
      var code = block.querySelector('code');
      if (code && !block.querySelector('.lang-tag')) {
        var lang = code.className.match(/language-(\w+)/);
        if (!lang) {
          lang = (block.getAttribute('data-lang') || '').match(/^(\w+)$/);
        }
        if (lang) {
          var tag = document.createElement('span');
          tag.className = 'lang-tag';
          tag.textContent = lang[1];
          block.appendChild(tag);
        }
      }
    });

    // highlight.js
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('.code-block pre code').forEach(function(el) {
        var lang = el.closest('.code-block') ? el.closest('.code-block').getAttribute('data-lang') : null;
        if (lang && hljs.getLanguage(lang)) {
          el.className = 'hljs language-' + lang;
          hljs.highlightElement(el);
        } else {
          hljs.highlightElement(el);
        }
      });
    }
  }

  // --- Diagram copy buttons (ASCII art) ---
  function setupDiagramCopy() {
    document.querySelectorAll('.diagram').forEach(function(block) {
      if (block.querySelector('svg')) return; // Skip SVG diagrams
      if (block.querySelector('.copy-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'copy-btn diagram-copy-btn';
      btn.textContent = 'Copy';
      block.classList.add('has-copy-btn');
      block.onmouseenter = function() { btn.classList.add('visible'); };
      block.onmouseleave = function() { btn.classList.remove('visible'); };
      btn.onclick = function() {
        var text = block.textContent.replace('Copy', '').replace(/✓/g, '').trim();
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '✓';
          setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
        });
      };
      block.appendChild(btn);
    });
  }

  // --- Diagram Zoom (SVG click to fullscreen) ---
  function setupDiagramZoom() {
    var existingOverlay = document.querySelector('.diagram-overlay');
    if (existingOverlay) return; // Already set up

    var overlay = document.createElement('div');
    overlay.className = 'diagram-overlay';
    overlay.innerHTML =
      '<button class="zoom-close" title="关闭 (Esc)">&times;</button>' +
      '<span class="zoom-hint">滚轮缩放 · 拖拽平移 · 点击空白处关闭</span>' +
      '<div class="diagram-overlay-inner"></div>' +
      '<div class="zoom-controls">' +
      '<button class="zoom-out" title="缩小">−</button>' +
      '<span class="zoom-level">100%</span>' +
      '<button class="zoom-in" title="放大">+</button>' +
      '<button class="zoom-reset" title="重置">⟲</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var inner = overlay.querySelector('.diagram-overlay-inner');
    var zoomLevelEl = overlay.querySelector('.zoom-level');
    var scale = 1, panX = 0, panY = 0, isDragging = false, dragX, dragY;
    var MIN = 0.2, MAX = 5;

    function update() {
      inner.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
      zoomLevelEl.textContent = Math.round(scale * 100) + '%';
    }
    function reset() { scale = 1; panX = 0; panY = 0; update(); }
    function close() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      inner.innerHTML = '';
    }

    document.addEventListener('click', function(e) {
      var diagram = e.target.closest('figure.diagram, .mermaid-wrap');
      if (!diagram || overlay.classList.contains('active')) return;
      var svg = diagram.querySelector('svg');
      if (!svg) return;
      inner.innerHTML = '';
      var clone = svg.cloneNode(true);
      clone.style.maxWidth = 'none';
      var vb = clone.getAttribute('viewBox');
      if (vb) { var p = vb.split(/[\s,]+/); clone.style.width = (parseInt(p[2]) || 700) + 'px'; }
      inner.appendChild(clone);
      reset();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(function() {
        var r = clone.getBoundingClientRect();
        var vw = window.innerWidth * 0.9, vh = window.innerHeight * 0.8;
        if (r.width > vw || r.height > vh) {
          scale = Math.min(vw / r.width, vh / r.height);
          update();
        }
      }, 50);
    });

    overlay.querySelector('.zoom-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target === inner) close();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });

    overlay.querySelector('.zoom-in').addEventListener('click', function(e) {
      e.stopPropagation(); scale = Math.min(MAX, scale * 1.25); update();
    });
    overlay.querySelector('.zoom-out').addEventListener('click', function(e) {
      e.stopPropagation(); scale = Math.max(MIN, scale / 1.25); update();
    });
    overlay.querySelector('.zoom-reset').addEventListener('click', function(e) {
      e.stopPropagation(); reset();
    });

    overlay.addEventListener('wheel', function(e) {
      e.preventDefault();
      scale = Math.max(MIN, Math.min(MAX, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      update();
    }, { passive: false });

    inner.addEventListener('mousedown', function(e) {
      isDragging = true; dragX = e.clientX - panX; dragY = e.clientY - panY;
      overlay.classList.add('grabbing'); e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      panX = e.clientX - dragX; panY = e.clientY - dragY; update();
    });
    document.addEventListener('mouseup', function() {
      isDragging = false; overlay.classList.remove('grabbing');
    });

    var lastDist = 0;
    inner.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        isDragging = true; dragX = e.touches[0].clientX - panX; dragY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
      e.preventDefault();
    }, { passive: false });
    inner.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1 && isDragging) {
        panX = e.touches[0].clientX - dragX; panY = e.touches[0].clientY - dragY; update();
      } else if (e.touches.length === 2 && lastDist > 0) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.max(MIN, Math.min(MAX, scale * (d / lastDist)));
        lastDist = d; update();
      }
      e.preventDefault();
    }, { passive: false });
    inner.addEventListener('touchend', function() { isDragging = false; lastDist = 0; });
  }

  // --- Mermaid dark mode ---
  function getMermaidTheme(isDark) { return isDark ? 'dark' : 'default'; }

  function setupMermaid() {
    if (typeof mermaid === 'undefined') return;
    var isDark = currentThemeIsDark();
    mermaid.initialize({
      startOnLoad: false,
      theme: getMermaidTheme(isDark),
      securityLevel: 'loose'
    });
    mermaid.run({ querySelector: '.mermaid' });
  }

  function rerenderMermaid(isDark) {
    if (typeof mermaid === 'undefined') return;
    document.querySelectorAll('.mermaid').forEach(function(el) {
      el.removeAttribute('data-processed');
      var src = el.getAttribute('data-mermaid-src');
      if (src) {
        el.textContent = src;
      }
    });
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: getMermaidTheme(isDark),
        securityLevel: 'loose'
      });
      mermaid.run({ querySelector: '.mermaid' });
    } catch (e) {
      console.warn('doc-shell: Mermaid rerender failed:', e.message);
    }
  }

  // --- Cmd+K / Ctrl+K in-page search ---
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      var query = prompt('搜索文档内容:');
      if (query) window.find(query, false, false, true);
    }
  });

  // --- Init ---
  // Preserve Mermaid source before rendering — must happen before ANY mermaid call
  document.querySelectorAll('.mermaid').forEach(function(el) {
    if (!el.getAttribute('data-mermaid-src')) {
      el.setAttribute('data-mermaid-src', el.textContent || el.innerHTML);
    }
  });

  // Each feature init wrapped in try-catch to prevent cascade failure
  var features = [
    ['TOC', buildTOC],
    ['ScrollSpy', setupScrollSpy],
    ['CodeBlocks', setupCodeBlocks],
    ['DiagramCopy', setupDiagramCopy],
    ['DiagramZoom', setupDiagramZoom],
    ['Mermaid', setupMermaid]
  ];
  features.forEach(function(f) {
    try { f[1](); }
    catch (e) { console.warn('doc-shell: ' + f[0] + ' init failed:', e.message); }
  });
})();
