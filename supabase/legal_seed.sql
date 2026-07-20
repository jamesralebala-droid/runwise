-- ============================================================================
-- RUNWISE — LEGAL DOCUMENT SEED CONTENT (RunWise Legal Pack v1.0)
-- ============================================================================
-- Draft content only — for review by qualified counsel in each applicable
-- jurisdiction before real-world use. Run after legal.sql.
-- ============================================================================

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('terms', '1.0', 'RunWise Terms and Conditions', '<h1>RunWise Terms and Conditions</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="acceptance">1. Acceptance</h2>
<p>By creating a RunWise account you agree to these Terms and to the RunWise Privacy Policy. If you do not agree, do not use RunWise.</p>
<h2 id="what-runwise-is">2. What RunWise is — and isn''t</h2>
<p>RunWise is a marketplace that connects Customers and Runners. To the maximum extent permitted by applicable law, Botwise does not itself transport goods, does not guarantee that any trip or request will be matched, completed, or delivered on any particular schedule, and does not guarantee the honesty, legality, or conduct of any Customer or Runner.</p>
<h2 id="eligibility">3. Eligibility</h2>
<p>You must be able to form a binding contract under the law of your country to use RunWise. Runners must hold any licence, roadworthiness certificate, insurance, operator authorisation, customs document, or transport permit required by law for the vehicle and route they use — RunWise verification is not a substitute for these and is not a guarantee that a Runner holds them.</p>
<h2 id="accounts">4. Accounts</h2>
<p>You are responsible for the accuracy of the information you provide and for activity on your account. Tell us promptly if you believe your account has been compromised.</p>
<h2 id="conduct">5. Conduct</h2>
<p>You agree not to use RunWise to send, request, or transport anything unlawful, and to comply with the RunWise Prohibited and Restricted Items Policy, Community and Safety Standards, and, where relevant, the Cross-Border Delivery Policy.</p>
<h2 id="fees">6. Fees</h2>
<p>Fees are disclosed before you fund an order, as described in the Payments and Escrow Policy.</p>
<h2 id="disputes">7. Disputes between users</h2>
<p>RunWise provides tools (Order Room, escrow, an admin dispute process) to help resolve disagreements between Customers and Runners, described further in the Refund and Cancellation Policy. Using these tools does not guarantee any particular outcome.</p>
<h2 id="liability">8. Limitation of liability</h2>
<p>To the maximum extent permitted by applicable law, Botwise''s liability arising from your use of RunWise is limited as set out in this section. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited.</p>
<h2 id="changes">9. Changes to these Terms</h2>
<p>We may publish a new version of these Terms. Material changes require your active re-acceptance before you can continue using RunWise, as described in the RunWise Legal Pack version policy.</p>
<h2 id="law">10. Governing law</h2>
<p>[EFFECTIVE DATE] — governing law and jurisdiction to be confirmed per the country in which the relevant use occurred, subject to legal review.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('privacy', '1.0', 'RunWise Privacy Policy', '<h1>RunWise Privacy Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="data-we-collect">1. Data we collect</h2>
<p>Account details (name, phone, email), identity verification documents for Runners (ID/passport image, selfie, next-of-kin contact), vehicle details and photos, trip and request details, messages sent through the Order Room, payment-related metadata (not full card/mobile-money credentials, which are handled by our payment partner directly), and, where you choose to share it during an active order, your approximate location for proximity-based contact reveal.</p>
<h2 id="how-we-use-it">2. How we use it</h2>
<p>To operate the marketplace (matching, escrow, delivery confirmation), to verify Runner identity and vehicles, to resolve disputes, to comply with legal and customs obligations, and to keep the platform safe.</p>
<h2 id="sharing">3. Sharing</h2>
<p>We share the minimum necessary information between a matched Customer and Runner (e.g. a name and, only once proximity conditions are met, a phone number), with our payment partner to process payments, and with authorities where required by law.</p>
<h2 id="storage-and-retention">4. Storage and retention</h2>
<p>Data is stored with role-based and row-level access controls. Identity documents are stored privately and are only viewable by you and authorised administrators.</p>
<h2 id="your-rights">5. Your rights</h2>
<p>Subject to applicable law, you may request access to, correction of, or deletion of your personal data by contacting [SUPPORT EMAIL]. Some records — including legal acceptance records and transaction history — are retained for legal, safety, or accounting reasons even after a deletion request.</p>
<h2 id="location">6. Location data</h2>
<p>Location sharing during an active order is optional and used only to determine proximity for a temporary contact reveal; it is not retained for tracking purposes beyond the order.</p>
<h2 id="children">7. Children</h2>
<p>RunWise is not directed at children and is not intended for use by anyone below the age of legal majority in their jurisdiction.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('runner_agreement', '1.0', 'RunWise Runner Agreement', '<h1>RunWise Runner Agreement</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="your-responsibility">1. Your responsibility as a Runner</h2>
<p>You are responsible for checking and maintaining any licence, roadworthiness certificate, insurance, operator authorisation, customs document, or transport permit required by law for your vehicle and route. RunWise verification of your identity, documents, or vehicle is not a guarantee of your safety, honesty, legal compliance, or future conduct, and is not a substitute for your own legal obligations.</p>
<h2 id="relationship">2. Relationship to Botwise</h2>
<p>Use of the word "independent contractor" or similar terms in this Agreement does not, by itself, determine your legal status. Your actual legal classification depends on the real working relationship and platform controls in place, and on the law of the relevant jurisdiction.</p>
<h2 id="conduct">3. Conduct</h2>
<p>You agree to comply with applicable road, transport, insurance, border, and customs laws; to accurately represent your vehicle and capacity; and not to knowingly accept goods that are unlawful, dangerous, or materially different from their stated description.</p>
<h2 id="fees-and-payouts">4. Fees and payouts</h2>
<p>Your fee for a completed order is disclosed before you accept a match and is described further in the Payments and Escrow Policy.</p>
<h2 id="standards">5. Standards</h2>
<p>You agree to the Community and Safety Standards and the Prohibited and Restricted Items Policy, and to complete the KYC and Verification Policy requirements before activating Runner Mode.</p>
<h2 id="suspension">6. Suspension and termination</h2>
<p>Botwise may restrict or suspend your ability to use Runner Mode for breach of this Agreement, a resolved dispute against you, or as required by law.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('payments_escrow', '1.0', 'RunWise Payments and Escrow Policy', '<h1>RunWise Payments and Escrow Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="how-it-works">1. How payment works</h2>
<p>When a Customer and Runner are matched, RunWise calculates a runner fee, a platform fee, and a protection fee based on the declared item/parcel value, shown to the Customer before funding. Funds are held pending delivery confirmation (by PIN) or resolution of a dispute.</p>
<h2 id="escrow-terminology">2. On the word "escrow"</h2>
<p>RunWise describes this arrangement as "escrow" for clarity, but this description is only accurate to the extent the underlying payment method and payment partner actually support holding funds in this way. [Once a payment partner is confirmed, this section should name that partner and accurately describe Botwise''s role in the flow of funds — a placeholder pending that confirmation.]</p>
<h2 id="release">3. Release of funds</h2>
<p>Funds are released to the Runner once the Customer confirms delivery with their Delivery PIN, or as directed by an admin resolving a dispute (see the Refund and Cancellation Policy).</p>
<h2 id="fees">4. Fees</h2>
<p>Current fee percentages are set by Botwise and shown to you before you fund an order. They may change for future orders; an order you have already funded keeps the fee amounts locked in at the time it was matched.</p>
<h2 id="no-payment-licence-claim">5. No claim of a payment licence</h2>
<p>Nothing in this Policy should be read as claiming that Botwise holds a banking, money transmission, or payment services licence unless and until such a licence is actually obtained and confirmed.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('refunds_cancellations', '1.0', 'RunWise Refund and Cancellation Policy', '<h1>RunWise Refund and Cancellation Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="before-funding">1. Before an order is funded</h2>
<p>Either party may decline or withdraw from a proposed match at no cost before escrow is funded.</p>
<h2 id="after-funding">2. After an order is funded</h2>
<p>Once escrow is funded, cancellation requires agreement between both parties or resolution through the RunWise dispute process.</p>
<h2 id="disputes">3. Disputes</h2>
<p>Either party may raise a dispute from the Order Room while an order is active. Raising a dispute freezes escrow immediately, pending review by a Botwise administrator. Possible outcomes include: releasing funds to the Runner, a full refund, a partial refund, a RunScore penalty for the Runner, or an account restriction or suspension. Botwise does not guarantee any particular dispute outcome.</p>
<h2 id="unused-funds">4. Unused shopping funds</h2>
<p>For shopping-type requests, any difference between the estimated value funded and the amount actually spent (as recorded at delivery confirmation) is credited back to the Customer.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('prohibited_items', '1.0', 'RunWise Prohibited and Restricted Items Policy', '<h1>RunWise Prohibited and Restricted Items Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="prohibited">1. Prohibited items</h2>
<p>You may not use RunWise to send or request: illegal drugs or controlled substances without lawful authorisation; weapons, ammunition, or explosives; counterfeit goods; items whose import or export is prohibited by any applicable law; live animals (unless specifically permitted by a future, clearly documented exception); human remains; and any item Botwise designates as prohibited via the compliance flag "prohibited_item".</p>
<h2 id="restricted">2. Restricted items</h2>
<p>Certain items — for example high-value goods, regulated medicines, or goods requiring a customs declaration or transport permit — may require additional confirmation, review, or documentation before a request or trip involving them can proceed. These requirements are applied through admin-configurable compliance flags (e.g. "customs_declaration_required", "regulated_item_review_required", "transport_permit_confirmation_required", "enhanced_kyc_required", "high_value_item_review_required") rather than a blanket regional block.</p>
<h2 id="your-responsibility">3. Your responsibility</h2>
<p>Customers are responsible for accurately describing what they are sending and for having the legal right to send it. Runners are responsible for not knowingly accepting goods that appear unlawful, dangerous, or materially different from their description.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('community_safety', '1.0', 'RunWise Community and Safety Standards', '<h1>RunWise Community and Safety Standards</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="respect">1. Respect</h2>
<p>Treat other RunWise users with respect in chat, in person, and in ratings. Harassment, threats, and discriminatory conduct are not permitted.</p>
<h2 id="honesty">2. Honesty</h2>
<p>Describe items, routes, capacity, and vehicles accurately. Do not misrepresent what you are sending, carrying, or charging.</p>
<h2 id="safety">3. Safety</h2>
<p>Meet in safe, public locations where possible for handovers. RunWise''s proximity-based contact reveal is designed to support safer, verified handovers, not to replace your own judgement.</p>
<h2 id="reporting">4. Reporting concerns</h2>
<p>Report safety concerns, suspicious activity, or policy violations through the dispute process or to [SUPPORT EMAIL].</p>
<h2 id="enforcement">5. Enforcement</h2>
<p>Violations may result in a RunScore penalty, account restriction, or suspension, as described in the Refund and Cancellation Policy''s dispute outcomes.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('kyc_verification', '1.0', 'RunWise KYC and Verification Policy', '<h1>RunWise KYC and Verification Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="why">1. Why we verify Runners</h2>
<p>Before activating Runner Mode, Runners submit an identity document, a selfie, and next-of-kin contact details for admin review, to support safer transactions on RunWise.</p>
<h2 id="not-a-guarantee">2. Verification is not a guarantee</h2>
<p>Approval of a Runner''s verification submission by Botwise confirms only that the submitted documents were reviewed — it is not a guarantee of that Runner''s safety, honesty, legal compliance, or future conduct, and is not a substitute for the Runner''s own legal obligation to hold any licence, insurance, or permit required by law.</p>
<h2 id="what-we-store">3. What we store</h2>
<p>Identity documents are stored in a private storage location accessible only to you and authorised administrators, consistent with the RunWise Privacy Policy.</p>
<h2 id="ongoing">4. Ongoing verification</h2>
<p>Botwise may require re-verification or additional documentation at any time, including in response to a dispute or a compliance flag such as "enhanced_kyc_required".</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('cross_border', '1.0', 'RunWise Cross-Border Delivery Policy', '<h1>RunWise Cross-Border Delivery Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="scope">1. Scope</h2>
<p>This Policy applies to any trip or request where the origin and destination are in different countries among Botswana, South Africa, Zimbabwe, and Zambia.</p>
<h2 id="customs">2. Customs and duties</h2>
<p>Cross-border deliveries may be subject to customs duties, taxes, inspections, delays, seizure, and documentation requirements imposed by the relevant customs authorities. RunWise does not guarantee customs clearance or approval, and is not responsible for delays or seizures resulting from customs processes.</p>
<h2 id="customer-responsibility">3. Customer responsibility</h2>
<p>The Customer is responsible for providing truthful customs information and for the lawful import and export of the item, and accepts responsibility for duties, taxes, and any customs consequences arising from the request.</p>
<h2 id="runner-responsibility">4. Runner responsibility</h2>
<p>The Runner is responsible for complying with applicable border, customs, and transport laws for the route, and for holding any transport permit or authorisation required for cross-border carriage.</p>
<h2 id="compliance-flags">5. Compliance flags</h2>
<p>Cross-border requests may be subject to additional compliance flags (e.g. "customs_declaration_required", "transport_permit_confirmation_required") set by Botwise administrators based on the specific route or item, not a blanket restriction on any region, town, or border post.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;

insert into legal_documents (document_type, version, title, body_html, effective_date, is_material, status, published_at)
values ('cookies', '1.0', 'RunWise Cookie Policy', '<h1>RunWise Cookie Policy</h1>
<p><em>Version 1.0 — Effective [EFFECTIVE DATE]</em></p>

<p><strong>[BOTWISE LEGAL NAME]</strong> ("Botwise", "we", "us") operates RunWise, a platform
connecting people who need something transported (a "Customer") with people already travelling
a route who agree to carry it for a fee (a "Runner"), across Botswana, South Africa, Zimbabwe,
and Zambia.</p>

<h2 id="what-we-use">1. What we use</h2>
<p>RunWise''s web application uses browser local storage and session data necessary to keep you logged in and to operate the application (for example, your current session token). It does not currently use third-party advertising cookies or trackers.</p>
<h2 id="managing">2. Managing this</h2>
<p>You can clear your browser''s local storage and cookies for the RunWise site at any time through your browser''s settings; doing so will log you out.</p>
<h2 id="changes">3. Changes</h2>
<p>If RunWise begins using additional cookies or similar technologies (for example, analytics), this Policy will be updated and, where the change is material, you will be asked to re-accept it.</p>

<h2 id="contact">Contact</h2>
<p>Questions about this document can be sent to [SUPPORT EMAIL]. Legal notices should be sent to [LEGAL EMAIL], [REGISTERED ADDRESS].</p>
<p><em>Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
', '[EFFECTIVE DATE]', false, 'published', now())
on conflict (document_type, version) do nothing;
