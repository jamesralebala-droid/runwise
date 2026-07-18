// RunWise Legal Foundation v1.1 frontend integration patch.
// Loaded after app.js so the current published legal version is always used.

async function getCurrentPublishedLegalDocument(documentType) {
  const { data, error } = await sb.from('legal_documents')
    .select('*')
    .eq('document_type', documentType)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

recordAcceptance = async function recordAcceptanceV11(documentType, context, relatedId = null) {
  if (!state.profile?.id) throw new Error('Your profile is not ready yet. Please try again.');
  const doc = await getCurrentPublishedLegalDocument(documentType);
  if (!doc) throw new Error(`No published ${documentType} document is available.`);

  const payload = {
    user_id: state.profile.id,
    document_type: documentType,
    document_version: doc.version,
    acceptance_context: context,
    related_record_id: relatedId,
    user_role: state.profile.active_role || state.profile.role || 'customer',
    user_agent: navigator.userAgent || null,
  };

  const { error } = await sb.from('legal_acceptances').insert(payload);
  if (error && !/duplicate key|already exists|23505/i.test(String(error.message || error.code || ''))) {
    throw error;
  }
  return doc.version;
};

renderLegalIndex = async function renderLegalIndexV11() {
  $('#legalToc').innerHTML = '';
  const { data, error } = await sb.from('legal_documents')
    .select('document_type,version,published_at,created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    $('#legalDoc').innerHTML = '<p class="empty">Legal documents are temporarily unavailable.</p>';
    return;
  }

  const latestByType = new Map();
  for (const doc of data || []) {
    if (!latestByType.has(doc.document_type)) latestByType.set(doc.document_type, doc);
  }
  const versions = [...latestByType.values()].map(doc => doc.version);
  const packVersion = versions.length && versions.every(v => v === versions[0]) ? versions[0] : 'current';

  $('#legalDoc').innerHTML = `<h1>RunWise Legal Documents</h1>
    <p><em>Current published RunWise Legal Pack${packVersion === 'current' ? '' : ` v${escapeHtml(packVersion)}`} — effective documents shown below.</em></p>
    <div class="legal-doc-list">${LEGAL_DOCS.map(([type, label]) => `<a href="#legal/${type}">${label}</a>`).join('')}</div>`;
};

renderLegalDoc = async function renderLegalDocV11(type) {
  $('#legalDoc').innerHTML = '<p class="loading">Loading…</p>';
  $('#legalToc').innerHTML = '';
  try {
    const doc = await getCurrentPublishedLegalDocument(type);
    if (!doc) {
      $('#legalDoc').innerHTML = `<p class="empty">This document isn't available right now.</p><p><a href="#legal">← All legal documents</a></p>`;
      return;
    }
    $('#legalDoc').innerHTML = doc.body_html;
    const headings = Array.from($('#legalDoc').querySelectorAll('h2[id]'));
    $('#legalToc').innerHTML = headings.length
      ? `<b>On this page</b>` + headings.map(h => `<a href="#legal/${type}#${h.id}">${h.textContent}</a>`).join('')
      : '';
  } catch (error) {
    console.error('Legal document load failed', error);
    $('#legalDoc').innerHTML = `<p class="empty">This document isn't available right now.</p><p><a href="#legal">← All legal documents</a></p>`;
  }
};

// Fix signup busy-state handling while preserving the existing flow.
$('#signupForm').onsubmit = async e => {
  e.preventDefault();
  $('#signupError').textContent = '';
  const button = e.submitter;
  const f = new FormData(e.target);

  if (!f.get('accept_terms') || !f.get('accept_privacy')) {
    $('#signupError').textContent = 'Please accept both the Terms and the Privacy Policy to continue.';
    setBusy(button, false);
    return;
  }

  setBusy(button, true, 'Creating account…');
  try {
    const { data, error } = await sb.auth.signUp({
      email: f.get('email'),
      password: f.get('password'),
      options: { data: { full_name: f.get('full_name'), role: f.get('role') } },
    });
    if (error) throw error;

    if (data.session) {
      state.profile = { id: data.user.id, active_role: f.get('role'), role: f.get('role') };
      await recordAcceptance('terms', 'registration');
      await recordAcceptance('privacy', 'registration');
    }

    toast('Account created. Check your email to confirm, then log in.');
    $('#tabLogin').click();
  } catch (error) {
    $('#signupError').textContent = friendlyError(error, 'Could not create the account.');
  } finally {
    setBusy(button, false);
  }
};

// app.js performs its first route check before this patch loads. Re-run legal
// routes once so direct #legal/... links use the v1.1-aware handlers above.
if (location.hash.startsWith('#legal')) checkLegalRoute();
