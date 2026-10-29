import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { mediaHref } from "../../../../lib/mediaUrl";
import {
  MobileScreen, Section, Card, InfoRow, Loader, Pill, EmptyState, PrimaryButton, kycBadgeFor,
} from "./brandMobileUi";

// Screen 1f — the submitted KYC credentials, read from GET verifications/me,
// the same source BrandKyc.jsx uses. Read-only by design: the mockup specs this
// screen as a record of what was submitted, with re-submission routed to the
// existing KYC form.

// Session 48 (Ravi: "show the details I entered, not Not provided everywhere"): any field the KYC answer
// leaves empty falls back to the brand's own profile (name, contact person, phone, email, website).
const firstFilled = (...v) => v.find((x) => x !== null && x !== undefined && String(x).trim() !== "" && String(x).trim() !== "—") ?? "";

export default function KycScreen({ onBack, kyc, loading, profile = {} }) {
  const navigate = useNavigate();
  const status = String(kyc?.status || "").toLowerCase();
  const badge = kycBadgeFor(status);
  const docs = kyc?.documents || {};
  const submitted = Boolean(kyc) && status !== "not_submitted";
  const needsInfo = ["more_info_needed", "more_info", "needs_info"].includes(status); // v358

  if (loading) {
    return (
      <MobileScreen title="KYC & compliance" onBack={onBack}>
        <Loader label="Checking your verification…" />
      </MobileScreen>
    );
  }

  if (!submitted) {
    return (
      <MobileScreen title="KYC & compliance" onBack={onBack}>
        <EmptyState
          icon={Shield}
          title="Not verified yet"
          body="Creators don't see a verified badge on your briefs, and you can't publish a campaign, until this clears."
          action={
            <button
              onClick={() => navigate("/brand/kyc")}
              className="h-11 px-5 rounded-xl bg-violet-600 text-white font-bold text-sm"
            >
              Start verification
            </button>
          }
        />
      </MobileScreen>
    );
  }

  const proofUrl = docs.business_proof_document_url || docs.incorporation_proof || docs.gst_cert_url || docs.gst_certificate || docs.pan_card_url || docs.pan_card || "";

  return (
    <MobileScreen
      title="KYC & compliance"
      onBack={onBack}
      footer={
        <PrimaryButton onClick={() => navigate("/brand/kyc?edit=true")}>
          {needsInfo || status === "rejected" ? "Update KYC" : "Edit & resubmit"}{/* v358 */}
        </PrimaryButton>
      }
    >
      <Section>
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 flex-wrap">{/* v332: wrap on 320px phones */}
            <Shield size={16} className="text-gray-900" />
            <Pill tone={badge.tone}>{badge.label}</Pill>
            <span className="text-xs text-gray-500 ml-auto">
              {[docs.gstin || docs.gst_cert ? "GST" : null, docs.brand_pan ? "PAN" : null]
                .filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
          {(status === "rejected" || needsInfo) && (kyc?.rejection_reason || kyc?.admin_note || kyc?.review_note) && (
            <p className={`text-xs mt-3 leading-relaxed ${needsInfo ? "text-amber-800" : "text-red-700"}`}>{kyc.rejection_reason || kyc.admin_note || kyc.review_note}</p>
          )}{/* v358: the admin's "more info needed" note shows too (was only for rejected) */}
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            Changing verified details starts the review again. Contact support if you only need a correction.
          </p>
        </div>
      </Section>

      <Section title="Submitted credentials" className="pt-0">
        <Card>
          <InfoRow label="Company name" value={firstFilled(docs.company_name, profile?.company_name)} />
          <InfoRow label="GSTIN" value={firstFilled(docs.gstin, docs.gst_cert, docs.gst_number)} />
          <InfoRow label="Corporate PAN" value={firstFilled(docs.brand_pan, docs.pan_number)} />
          <InfoRow label="Authorised officer" value={[firstFilled(docs.poc_name, profile?.pocName), firstFilled(docs.poc_designation, profile?.pocDesignation)].filter(Boolean).join(" · ")} />
          <InfoRow label="Liaison phone" value={firstFilled(docs.poc_phone, profile?.pocPhone)} />
          <InfoRow label="Authorised email" value={firstFilled(docs.poc_email, profile?.pocEmail)} />
          <InfoRow label="Website" value={firstFilled(docs.website, docs.website_url, profile?.website)} last={!proofUrl} />
          {proofUrl && (
            <a
              href={mediaHref(proofUrl) /* v332: KYC files are private — open through the media link, not the raw path */}
              target="_blank"
              rel="noreferrer"
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50"
            >
              <FileText size={15} className="text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="text-xs text-gray-500">Business document</div>{/* v332: may be GST / PAN proof, not always an incorporation certificate */}
                <div className="text-sm font-semibold text-gray-900 mt-0.5">View document</div>
              </div>
              <ExternalLink size={13} className="text-gray-300 flex-shrink-0" />
            </a>
          )}
        </Card>
      </Section>
    </MobileScreen>
  );
}
