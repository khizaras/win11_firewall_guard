(function () {
  var button = document.querySelector('.menu');
  var nav = document.querySelector('.global nav');
  if (button && nav) {
    button.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('show');
      });
    }, { threshold: 0.22 });
    document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('show'); });
  }

  var scrub = document.querySelector('[data-scrub]');
  var card = document.querySelector('[data-step]');
  if (!scrub || !card) return;

  var lines = [
    ['Select the rows.', 'Services, programs, and remote addresses can share one batch. The console groups them before anything is sent.'],
    ['Confirm the batch.', 'You see every target. Dry-run records the intent and leaves Windows Firewall unchanged.'],
    ['Approve once.', 'Live mode raises a single UAC prompt for the whole batch, up to 50 rules.'],
    ['Each rule is verified.', 'Names start with FGF-. The console checks them with Get-NetFirewallRule and writes the result locally.']
  ];
  var title = scrub.querySelector('[data-title]');
  var detail = scrub.querySelector('[data-detail]');
  var dots = scrub.querySelectorAll('.steps-inline button');

  function setStep(step) {
    card.setAttribute('data-step', String(step));
    if (title) title.textContent = lines[step][0];
    if (detail) detail.textContent = lines[step][1];
    dots.forEach(function (dot, i) { dot.setAttribute('aria-current', i === step ? 'true' : 'false'); });
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () { setStep(Number(dot.dataset.go)); });
  });

  if (reduce) {
    setStep(3);
    return;
  }

  function onScroll() {
    var rect = scrub.getBoundingClientRect();
    var total = scrub.offsetHeight - window.innerHeight;
    var passed = total <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / total));
    setStep(Math.min(3, Math.floor(passed * 4)));
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
