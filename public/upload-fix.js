// ============================================================================
// RunWise — Upload enhancer (reliable picker + visible feedback)
// ----------------------------------------------------------------------------
// The app's file inputs (KYC ID/selfie, vehicle photos, payment screenshot)
// are small native controls with no visible response after a file is chosen,
// which reads as "not responding" on phones and inside in-app browsers.
//
// Two fixes:
//  1. Stretch the real file input invisibly across its whole <label>, so the
//     entire box is one big, reliable tap target and the click lands directly
//     on the native input (no label-forwarding quirks).
//  2. Show live feedback on selection: file name + image thumbnail.
//
// Re-applies automatically after app.js re-renders the page.
// ============================================================================
(function () {
  'use strict';

  function enhance(input) {
    if (input.dataset.uploadEnhanced) return;
    input.dataset.uploadEnhanced = '1';

    // 1. Reliable hit area: stretch the real input over the whole label.
    const label = input.closest('label');
    if (label) {
      label.classList.add('upload-fix-box');
    }

    // 2. Feedback line: file name + thumbnail preview after the input.
    const feedback = document.createElement('div');
    feedback.className = 'upload-feedback';

    const nameEl = document.createElement('span');
    nameEl.className = 'upload-feedback-name';
    nameEl.textContent = 'No file chosen';

    const preview = document.createElement('img');
    preview.className = 'upload-feedback-preview';
    preview.alt = 'Selected file preview';
    preview.hidden = true;

    feedback.appendChild(nameEl);
    feedback.appendChild(preview);
    input.parentNode.insertBefore(feedback, input.nextSibling);

    let currentUrl = null;
    input.addEventListener('change', () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
      const files = input.files ? Array.from(input.files) : [];
      if (!files.length) {
        nameEl.textContent = 'No file chosen';
        preview.hidden = true;
        preview.removeAttribute('src');
        return;
      }
      if (files.length === 1) {
        nameEl.textContent = files[0].name;
        if (files[0].type && files[0].type.indexOf('image/') === 0) {
          currentUrl = URL.createObjectURL(files[0]);
          preview.src = currentUrl;
          preview.hidden = false;
        } else {
          preview.hidden = true;
        }
      } else {
        nameEl.textContent = files.length + ' files chosen';
        preview.hidden = true;
      }
    });
  }

  function enhanceAll() {
    document.querySelectorAll('#content input[type="file"]').forEach(enhance);
  }

  // Re-run whenever app.js swaps the page content (new view rendered).
  const app = document.getElementById('app');
  if (app && typeof MutationObserver !== 'undefined') {
    new MutationObserver(enhanceAll).observe(app, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }
})();
