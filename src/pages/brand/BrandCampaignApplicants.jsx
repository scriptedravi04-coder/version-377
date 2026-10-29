import GeminiIcon from "../../components/common/GeminiIcon";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import ApplicantCard from "../../components/campaigns/ApplicantCard";
import RejectApplicantSheet from "../../components/campaigns/RejectApplicantSheet";
import ExportAnalyticsPdfButton from "../../components/common/ExportAnalyticsPdfButton";
import { ArrowLeft, Megaphone, Users, HelpCircle, Loader2 } from "lucide-react";
import { useLiveRefresh } from "../../lib/liveRefresh";
import useIsMobile from "../../hooks/useIsMobile";
import BrandCampaignDetailMobile from "../../components/campaigns/mobile/BrandCampaignDetailMobile";
import { hiredCreatorIds } from "../../lib/hiredCreators";
import { maskContact } from "../../utils/maskContact";

export default function BrandCampaignApplicants() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [campaign, setCampaign] = useState(location.state?.campaign || null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRoi, setAiRoi] = useState(null);
  const [isPredictingRoi, setIsPredictingRoi] = useState(false);
  const [appsError, setAppsError] = useState(false); // v330: failed load ≠ "No applicant entries yet"
  const actionBusy = useRef(false); // v330: double tap on Shortlist/Decline sent the action twice
  const isMobile = useIsMobile();

  const handlePredictRoi = async () => {
    setIsPredictingRoi(true);
    try {
      const { data } = await api.post("ai/predict-roi", { campaign, creators: applicants });
      setAiRoi(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.response?.data?.detail || "Couldn't get the ROI estimate right now. Please try again."); // v332: no raw tech text
    } finally {
      setIsPredictingRoi(false);
    }
  };

  const loadData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      
      // Fetch campaign details
      try {
        const { data: campDetail } = await api.get(`/campaigns/${id}`);
        if (campDetail) {
          setCampaign(campDetail);
        }
      } catch (e) {
        const { data: camps } = await api.get("campaigns?mine=true").catch(() => ({ data: [] }));
        const found = camps?.find(c => String(c.campaign_id || c.id) === String(id));
        if (found) {
          setCampaign(found);
        }
      }
      
      // Fetch actual applicants from backend
      try {
        const { data: apps } = await api.get(`/campaigns/${id}/applications`);
        setApplicants(Array.isArray(apps) ? apps : []); // v332: a non-list answer crashed the list
        setAppsError(false);
      } catch (err) {
        // v330: keep the list already on screen (a background refresh blip emptied it); flag the error.
        setAppsError(true);
      }
      
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.response?.data?.detail || "Couldn't load applicants. Please try again."); // v332
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Session 28: a creator applies → the applicant appears here within seconds (no refresh).
  useLiveRefresh(loadData, { types: ["application", "campaign", "deal", "chat"], intervalMs: 30000 });

  const [shortlistingId, setShortlistingId] = useState(null); // v358: visible busy state on the tapped card
  const handleShortlist = async (app) => {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setShortlistingId(app.application_id);
    try {
      const { data } = await api.post(`/campaigns/${id || campaign?.campaign_id}/applications/${app.application_id}/action`, { action: "accept" });
      const who = app.full_name || app.creator_name || app.name || "Creator"; // v332: no "undefined has been shortlisted"
      if (data?.thread_id) { // v330: no crash (and a contradicting error toast) on an empty reply
        toast.success(`${who} has been shortlisted! Opening the chat.`);
        navigate(`/chat/${data.thread_id}`);
      } else {
        // v358: one clear message (it said "Opening the chat" and then "thread not found") + refresh the card
        toast.success(`${who} has been shortlisted. Open the chat from Inbox.`);
        loadData({ silent: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || "Couldn't shortlist this creator. Please try again."); // v332: calm copy
    } finally {
      actionBusy.current = false;
      setShortlistingId(null);
    }
  };

  // v333 (Ravi): the app's own Decline sheet instead of the browser's grey prompt box. Same API call.
  const [rejecting, setRejecting] = useState(null);
  const handleReject = (app) => { if (!actionBusy.current) setRejecting(app); };
  const confirmReject = async (reason) => {
    const app = rejecting;
    if (!app || actionBusy.current) return;
    actionBusy.current = true;
    try {
      // Session 25: the reason goes with the API call. This also wrote a "brand_applications"
      // table from the browser — the app's table is campaign_applications, so that write went
      // nowhere (or into a leftover table anyone could write).
      await api.post(`/campaigns/${id || campaign?.campaign_id}/applications/${app.application_id}/action`, { action: "reject", reason });

      toast.success("Application declined."); // v332: plain copy
      setApplicants(prev => prev?.filter(a => a.application_id !== app.application_id));
      setRejecting(null);
    } catch (e) {
      toast.error(
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        "Couldn't decline this application. Please try again." // v332: no raw err.message
      );
    } finally {
      actionBusy.current = false;
    }
  };
  const rejectSheet = <RejectApplicantSheet applicant={rejecting} onCancel={() => setRejecting(null)} onConfirm={confirmReject} />;

  const exportCsv = () => {
    if (!applicants.length) return toast.error("No applicants to export.");
    // Session 58: Email / Platform / Handle / Message were always blank (fields the API never sends).
    const headers = ["Name", "Instagram", "City", "Pitch", "Proposed amount", "Status"];
    const csvContent = applicants.map(a => 
      [a.full_name || a.creator_name || a.name, a.instagram_handle, a.city || a.creator_location, maskContact(a.pitch_text || a.pitch) /* v346 */, a.proposed_amount, a.status].map(val => `"${(val || "").toString().replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([headers.join(",") + "\n" + csvContent.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applicants-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Session 33: which applicants are hired (secure payment hold funded) — from the same chat-thread list the
  // Chat button already reads. Mobile only (the desktop page has no Hired tab).
  const [hiredIds, setHiredIds] = useState(() => new Set());
  useEffect(() => {
    if (!isMobile || !(id || campaign?.campaign_id)) return undefined;
    let alive = true;
    api.get('chat/v2/threads').then(({ data }) => { if (alive) setHiredIds(hiredCreatorIds(data, id || campaign?.campaign_id)); }).catch(() => {});
    return () => { alive = false; };
  }, [isMobile, id, campaign?.campaign_id, applicants?.length]);

  const handleProfileView = (app) => {
    navigate(`/creator/${app.creator_id}`);
  };

  const handleChat = async (app) => {
    try {
      // Find the thread
      const { data } = await api.get('chat/v2/threads');
      const thread = data.find(t => t.campaign_id === (app.campaign_id || id) && t.creator_id === app.creator_id);
      if (thread) {
        navigate(`/chat/${thread.id}`);
      } else {
        toast.error("Chat thread not found.");
      }
    } catch(err) {
      toast.error("Could not open chat");
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-none px-4 py-8 animate-pulse bg-[var(--bg-base)] min-h-screen">
        <div className="h-10 bg-gray-200 dark:bg-zinc-800 rounded-xl w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(k => (
            <div key={k} className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-3xl p-6 border border-[var(--border-default)]"></div>
          ))}
        </div>
      </div>
    );
  }

  // Session 30: phones get Ravi's mobile design (MG-04/05/06). Same data and applicant actions.
  if (isMobile) {
    return (
      <>
      <BrandCampaignDetailMobile
        campaignId={id}
        campaign={campaign}
        applicants={applicants || []}
        aiRoi={aiRoi}
        isPredictingRoi={isPredictingRoi}
        onPredictRoi={handlePredictRoi}
        onShortlist={handleShortlist}
        onReject={handleReject}
        onProfileView={handleProfileView}
        onChat={handleChat}
        onReload={loadData}
        appsError={appsError} /* v344: a failed applicants load ≠ "No pitches yet" */
        hiredCreatorIds={hiredIds}
      />
      {rejectSheet}
      </>
    );
  }

  return (
    <div className="w-full max-w-none text-left min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mb-8">
        <button 
          onClick={() => navigate("/brand/campaigns")}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-all"
        >
          <ArrowLeft size={14} /> Back to My Campaigns
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-3 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 uppercase tracking-normal ${
                (campaign?.status || '').toLowerCase() === 'live' 
                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                  : ((campaign?.status || '').toLowerCase() === 'under_review' || (campaign?.status || '').toLowerCase() === 'under review')
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {((campaign?.status || '').toLowerCase() === 'under_review' || (campaign?.status || '').toLowerCase() === 'under review') ? (
                  <span className="relative flex h-2 w-2 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                ) : (
                  <Megaphone size={12} className="text-purple-600" />
                )}
                <span className={((campaign?.status || '').toLowerCase() === 'under_review' || (campaign?.status || '').toLowerCase() === 'under review') ? 'animate-pulse' : ''}>
                  {/* v358: paused / closed campaigns said "Active Campaign Briefing" or a raw code */}
                  {(String(campaign?.status || '').toLowerCase() === 'completed' || campaign?.closed_at) ? 'Closed' : campaign?.applications_paused ? 'Applications paused' : ['live', 'approved'].includes(String(campaign?.status || '').toLowerCase()) ? 'Live' : ['under_review', 'under review', 'pending_review'].includes(String(campaign?.status || '').toLowerCase()) ? 'Under review' : String(campaign?.status || '').toLowerCase() === 'draft' ? 'Draft' : ['rejected', 'cancelled'].includes(String(campaign?.status || '').toLowerCase()) ? 'Not approved' : 'Live'}
                </span>
              </span>
              <span className="text-[var(--text-primary)]/20">•</span>
              <span className="text-emerald-700 text-xs font-semibold font-sans">
                {campaign?.budget_max && Number(campaign.budget_max) > Number(campaign.budget_min || 0) ? (
                  `₹${Number(campaign.budget_min || 0).toLocaleString("en-IN")} - ₹${Number(campaign.budget_max).toLocaleString("en-IN")}`
                ) : Number(campaign?.budget_min || campaign?.budget) > 0 ? (
                  `₹${Number(campaign?.budget_min || campaign?.budget).toLocaleString("en-IN")}`
                ) : (
                  // v330: no budget on the brief → say so; it used to show an invented ₹10,000.
                  "Budget not set"
                )}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1.5 line-clamp-2 [overflow-wrap:anywhere]" title={campaign?.title || ""}>
              {campaign?.title || "Campaign Applicants"}{/* v346: very long titles clamp to 2 lines */}
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative group">
              <div className="absolute -top-2.5 -right-2.5 z-20 overflow-hidden rounded-md">
                <span className="relative inline-block bg-[#FF0033] shadow-[0_0_8px_rgba(255,0,51,0.5)] text-white text-[9px] font-black px-1.5 py-0.5 rounded drop-shadow-sm uppercase tracking-wider overflow-hidden">
                  <span className="relative z-10">NEW</span>
                  <span className="absolute top-0 bottom-0 left-0 w-full bg-white opacity-40 animate-shine"></span>
                </span>
              </div>
              <ExportAnalyticsPdfButton 
                campaign={campaign} 
                applicants={applicants} 
                aiRoi={aiRoi} 
                buttonText="Download Analysis" 
                variant="box" 
              />
            </div>
            
            <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-default)] px-4 py-2.5 rounded-2xl shadow-sm">
              <Users size={18} className="text-[var(--violet)] shrink-0" />
              <div className="text-left font-sans">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Pitching pool</div>
                <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{applicants.length} {applicants.length === 1 ? 'Creator Pitch' : 'Creator Pitches'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      

      <div className="mt-6 mb-8 pt-6 border-t border-[var(--border-default)]">
        <h4 className="font-bold text-sm text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <GeminiIcon className="w-4 h-4" />
          Predictive AI ROI
        </h4>
        {aiRoi ? (
          <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-default)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[var(--text-secondary)]">Est. Reach</span>
              <span className="text-sm font-bold text-[var(--text-primary)]">{aiRoi.estimatedReach != null ? Number(aiRoi.estimatedReach).toLocaleString("en-IN") : "—"}</span>{/* v332: no blank / NaN */}
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[var(--text-secondary)]">Est. Engagement</span>
              <span className="text-sm font-bold text-[var(--text-primary)]">{aiRoi.estimatedEngagement != null ? Number(aiRoi.estimatedEngagement).toLocaleString("en-IN") : "—"}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-[var(--text-secondary)]">ROI Multiplier</span>
              <span className="text-sm font-black text-emerald-500">{aiRoi.roiMultiplier != null && aiRoi.roiMultiplier !== "" ? `${aiRoi.roiMultiplier}x` : "—"}</span>{/* v332: was "undefinedx" */}
            </div>
            <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">{aiRoi.analysis}</p>
          </div>
        ) : (
          <button 
            onClick={handlePredictRoi}
            disabled={isPredictingRoi}
            className="w-full py-3 bg-[var(--violet)]/10 text-[var(--violet)] border border-[var(--violet)]/30 hover:bg-[var(--violet)]/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed" /* v332: looks busy while predicting */
          >
            {isPredictingRoi ? <Loader2 size={16} className="animate-spin" /> : <GeminiIcon className="w-4 h-4" />}
            Predict ROI for Applicant Pool
          </button>
        )}
      </div>


      <div className="grid grid-cols-1 gap-5">
        {applicants.length === 0 && appsError ? (
          // v330: the request failed — say so and offer a retry.
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center justify-center">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Couldn't load applicants</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">Check your connection and try again.</p>
            <button type="button" onClick={() => loadData()} className="mt-4 h-10 px-5 rounded-xl bg-[var(--violet)] text-white text-xs font-bold cursor-pointer">Try again</button>
          </div>
        ) : applicants.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-16 text-center max-w-2xl mx-auto flex flex-col items-center justify-center">
            <div className="p-4 bg-[var(--bg-elevated)] text-[var(--text-tertiary)] rounded-full mb-3">
              <HelpCircle size={28} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">No applicant entries yet</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5 leading-relaxed max-w-md">
              Pitches from creators will show up here as soon as verification completes. You can share your active campaign briefing URL to promote your listing!
            </p>
          </div>
        ) : (
          applicants?.map((app, index) => (
            <ApplicantCard
              key={(app.application_id || app.id) ? (app.application_id || app.id) + "-" + index : index}
              applicant={app}
              onShortlist={handleShortlist}
              onReject={handleReject}
              onViewProfile={handleProfileView}
              onChat={handleChat}
              busy={shortlistingId != null && String(shortlistingId) === String(app.application_id)} /* v358 */
            />
          ))
        )}
      </div>
      {rejectSheet}
    </div>
  );
}
