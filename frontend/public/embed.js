(function () {
  var script =
    document.currentScript ||
    (function () {
      // document.currentScript is null when the tag is loaded async/deferred,
      // so fall back to the last <script> that points at this file.
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if ((all[i].src || '').indexOf('embed.js') !== -1) return all[i];
      }
      return null;
    })();

  if (!script) {
    console.error('Meetora: could not locate embed script tag');
    return;
  }

  var slug = script.getAttribute('data-form') || '';
  var containerId = script.getAttribute('data-container');

  if (!slug) {
    console.error('Meetora: data-form attribute required');
    return;
  }

  // Derive the form host from where this script itself was served, so the
  // snippet works unchanged across local, staging and production without
  // anyone editing a hardcoded domain into it.
  var origin;
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    origin = window.location.origin;
  }

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/forms/' + encodeURIComponent(slug);
  iframe.style.cssText =
    'width:100%;border:none;min-height:500px;border-radius:12px;';
  iframe.title = 'Meetora Form';
  iframe.setAttribute('loading', 'lazy');

  var target = containerId
    ? document.getElementById(containerId)
    : document.body;

  if (!target) {
    console.error('Meetora: container #' + containerId + ' not found');
    return;
  }

  target.appendChild(iframe);

  // Auto-resize from the form page's postMessage, ignoring messages from any
  // other origin so an unrelated page can't drive the frame's height.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.type === 'meetora-resize' && e.data.height) {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
