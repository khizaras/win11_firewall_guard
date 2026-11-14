(function () {
  'use strict';

  var root = document.documentElement;
  var motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideMedia = window.matchMedia('(min-width: 64rem) and (min-height: 56.25rem)');
  var motionValues = ['standard', 'enhanced', 'reduced', 'off'];
  var motion = 'standard';
  var ticking = false;
  var workflowControllers = [];

  document.querySelectorAll('[data-motion-control]').forEach(function (control) {
    control.hidden = false;
  });

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.hidden = false;
  });

  function readMotionPreference() {
    try {
      var saved = window.localStorage.getItem('fgf.website.motion');
      if (motionValues.indexOf(saved) !== -1) return saved;
    } catch (error) {
      return motionMedia.matches ? 'reduced' : 'standard';
    }
    return motionMedia.matches ? 'reduced' : 'standard';
  }

  function saveMotionPreference(value) {
    try {
      window.localStorage.setItem('fgf.website.motion', value);
    } catch (error) {
      return;
    }
  }

  function allowsSpatialMotion() {
    return motion === 'standard' || motion === 'enhanced';
  }

  function applyMotion(value, persist) {
    motion = motionValues.indexOf(value) === -1 ? 'standard' : value;
    root.setAttribute('data-motion', motion);

    document.querySelectorAll('[data-motion-preference]').forEach(function (select) {
      select.value = motion;
    });

    document.querySelectorAll('[data-motion-toggle]').forEach(function (button) {
      var paused = motion === 'off';
      button.setAttribute('aria-pressed', paused ? 'true' : 'false');
      button.setAttribute('aria-label', paused ? 'Enable website motion' : 'Pause website motion');
      button.setAttribute('title', paused ? 'Enable motion' : 'Pause motion');
    });

    if (persist) saveMotionPreference(motion);
    configureWorkflowScroll();
    requestTick();
  }

  document.querySelectorAll('[data-motion-preference]').forEach(function (select) {
    select.addEventListener('change', function () {
      applyMotion(select.value, true);
    });
  });

  document.querySelectorAll('[data-motion-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyMotion(motion === 'off' ? 'standard' : 'off', true);
    });
  });

  document.querySelectorAll('.mobile-menu').forEach(function (menu) {
    var summary = menu.querySelector('summary');
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.removeAttribute('open');
        if (summary) summary.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (menu.open && !menu.contains(event.target)) menu.removeAttribute('open');
    });
  });

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function initWorkflow(workflow, workflowIndex) {
    var tabs = Array.prototype.slice.call(workflow.querySelectorAll('[data-workflow-tab]'));
    var panels = Array.prototype.slice.call(workflow.querySelectorAll('[data-workflow-panel]'));
    if (!tabs.length || tabs.length !== panels.length) return;

    var selected = 0;
    var tabList = workflow.querySelector('[data-workflow-tabs]');
    if (tabList) tabList.setAttribute('role', 'tablist');

    tabs.forEach(function (tab, index) {
      var panel = panels[index];
      var tabId = tab.id || 'workflow-' + workflowIndex + '-tab-' + index;
      var panelId = panel.id || 'workflow-' + workflowIndex + '-panel-' + index;
      tab.id = tabId;
      panel.id = panelId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panelId);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);

      tab.addEventListener('click', function () {
        selectStep(index);
      });

      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        selectStep(next);
        tabs[next].focus();
      });
    });

    function selectStep(index) {
      selected = clamp(index, 0, tabs.length - 1);
      tabs.forEach(function (tab, tabIndex) {
        var active = tabIndex === selected;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');
        panels[tabIndex].classList.toggle('is-active', active);
        panels[tabIndex].setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) {
          panels[tabIndex].removeAttribute('inert');
        } else {
          panels[tabIndex].setAttribute('inert', '');
        }
      });
      workflow.setAttribute('data-active-step', String(selected));
    }

    workflow.classList.add('is-enhanced');
    selectStep(0);
    workflowControllers.push({
      element: workflow,
      tabs: tabs,
      select: selectStep,
      getSelected: function () { return selected; }
    });
  }

  document.querySelectorAll('[data-workflow]').forEach(initWorkflow);

  function configureWorkflowScroll() {
    workflowControllers.forEach(function (controller) {
      var enabled = allowsSpatialMotion() && wideMedia.matches;
      controller.element.classList.toggle('is-scroll-enabled', enabled);
      if (!enabled) controller.element.style.removeProperty('--workflow-progress');
    });
  }

  function updateWorkflow(controller) {
    var workflow = controller.element;
    if (!workflow.classList.contains('is-scroll-enabled')) return;
    var rect = workflow.getBoundingClientRect();
    var total = Math.max(1, workflow.offsetHeight - window.innerHeight);
    var progress = clamp(-rect.top / total, 0, 0.9999);
    var step = Math.min(controller.tabs.length - 1, Math.floor(progress * controller.tabs.length));
    workflow.style.setProperty('--workflow-progress', progress.toFixed(4));
    if (step !== controller.getSelected()) controller.select(step);
  }

  var networkScenes = Array.prototype.slice.call(document.querySelectorAll('[data-network-scene]'));
  networkScenes.forEach(function (scene) {
    scene.querySelectorAll('[data-draw-path]').forEach(function (path) {
      if (typeof path.getTotalLength !== 'function') return;
      var length = path.getTotalLength();
      path.dataset.pathLength = String(length);
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });
  });

  function updateNetworkScene(scene) {
    var paths = scene.querySelectorAll('[data-draw-path]');
    if (!allowsSpatialMotion()) {
      paths.forEach(function (path) { path.style.strokeDashoffset = '0'; });
      scene.style.setProperty('--scene-progress', '1');
      return;
    }
    var rect = scene.getBoundingClientRect();
    var progress = clamp((window.innerHeight * 0.82 - rect.top) / (window.innerHeight * 0.72 + rect.height * 0.35), 0, 1);
    scene.style.setProperty('--scene-progress', progress.toFixed(4));
    paths.forEach(function (path, index) {
      var length = Number(path.dataset.pathLength || 0);
      var local = clamp(progress * 1.35 - index * 0.1, 0, 1);
      path.style.strokeDashoffset = String(length * (1 - local));
    });
  }

  function updateScrollScenes() {
    ticking = false;
    var scrollTop = window.scrollY || window.pageYOffset || 0;
    var header = document.querySelector('[data-header]');
    if (header) header.classList.toggle('is-scrolled', scrollTop > 12);

    document.querySelectorAll('[data-hero]').forEach(function (hero) {
      var progress = allowsSpatialMotion() ? clamp(scrollTop / Math.max(1, hero.offsetHeight * 0.8), 0, 1) : 0;
      hero.style.setProperty('--hero-progress', progress.toFixed(4));
    });

    workflowControllers.forEach(updateWorkflow);
    networkScenes.forEach(updateNetworkScene);
  }

  function requestTick() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollScenes);
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', function () {
    configureWorkflowScroll();
    requestTick();
  }, { passive: true });

  if (typeof motionMedia.addEventListener === 'function') {
    motionMedia.addEventListener('change', function (event) {
      if (event.matches) applyMotion('reduced', false);
    });
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('[data-reveal]').forEach(function (element) {
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (element) {
      element.classList.add('is-visible');
    });
  }

  function copyWithFallback(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        var copied = document.execCommand('copy');
        document.body.removeChild(field);
        if (copied) resolve();
        else reject(new Error('Copy was not available'));
      } catch (error) {
        document.body.removeChild(field);
        reject(error);
      }
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var label = button.querySelector('[data-copy-label]');
      var original = label ? label.textContent : '';
      copyWithFallback(button.getAttribute('data-copy') || '').then(function () {
        if (label) label.textContent = 'Copied';
        button.setAttribute('aria-label', 'Copied to clipboard');
        var status = document.querySelector('[data-copy-status]');
        if (status) status.textContent = 'Copied to clipboard.';
        window.setTimeout(function () {
          if (label) label.textContent = original;
          button.setAttribute('aria-label', button.getAttribute('data-copy-name') || 'Copy to clipboard');
        }, 1800);
      }).catch(function () {
        if (label) label.textContent = 'Select text';
        var status = document.querySelector('[data-copy-status]');
        if (status) status.textContent = 'Automatic copy was unavailable. Select the command and copy it manually.';
      });
    });
  });

  applyMotion(readMotionPreference(), false);
  configureWorkflowScroll();
  requestTick();
})();
