import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Info, Phone, User, HelpCircle, ChevronRight, Clock, Send, X, Globe, MapPin, Building } from 'lucide-react';
import { toast } from 'sonner';
import { calmError } from "./calmError"; // v332
import { api } from '../../lib/api';
import BlockUserButton from '../safety/BlockUserButton'; // v337: block the other person

export default function BurgerMenuSupport({ thread, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const buttonRef = useRef(null);
  const toggleMenu = () => {
    if (isOpen) { setIsOpen(false); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    setMenuPos(r ? { top: Math.round(r.bottom + 8), right: Math.max(12, Math.round(window.innerWidth - r.right)) } : { top: 64, right: 12 });
    setIsOpen(true);
  };
  // Close on back-navigation / route change so it can never be left open behind a new screen.
  useEffect(() => {
    if (!isOpen) return undefined;
    const close = () => setIsOpen(false);
    window.addEventListener("popstate", close);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("popstate", close); window.removeEventListener("resize", close); };
  }, [isOpen]);
  const [activeModal, setActiveModal] = useState(null); // 'status' | 'details' | 'contacts' | 'support'
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMsg, setSupportMsg] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);

  const isBrand = user?.role === 'brand' || user?.user_type === 'brand';
  // A UGC thread has no `campaigns` row — its details live on the brief. Reading only
  // `thread.campaigns` is why UGC orders showed an empty panel titled "Direct Sponsorship".
  const isUgc = Boolean(
    thread?.is_ugc ||
    thread?.ugc_order_id ||
    thread?.ugc_brief_id ||
    String(thread?.deal_type || '').toUpperCase() === 'UGC' ||
    String(thread?.type || '').toLowerCase() === 'ugc' ||
    String(thread?.id || '').startsWith('thread_ugc_') ||
    String(thread?.deal_id || '').startsWith('ugcord_')
  );
  const campaign = (isUgc ? (thread?.ugc_brief || thread?.brief) : thread?.campaigns) || thread?.campaigns || {};
  const detailsLabel = isUgc ? 'UGC Order Details' : 'Campaign Details';
  const titleLabel = isUgc ? 'UGC Order & Brief Details' : 'Campaign Title';
  const creator = thread?.creator || {};
  const creatorProfile = creator?.profile || {};
  const brand = thread?.brand || {};

  const handleContactSupportSubmit = async (e) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMsg.trim()) {
      toast.error("Please provide both subject and description.");
      return;
    }
    setSendingSupport(true);
    try {
      const { data } = await api.post('/support/tickets', {
        subject: supportSubject.trim(),
        message: supportMsg.trim(),
        category: 'chat_dispute_support',
        thread_id: thread?.id
      });
      // v332: read "Support Ticket #Created Dispatched!" when no ticket id came back (and crashed on an empty reply)
      toast.success(data?.ticket_id ? `Support ticket #${String(data.ticket_id).slice(0, 8)} raised` : "Support ticket raised", {
        description: "The Ybex support team has your request and will reply by email shortly.",
        duration: 8000
      });
      setSupportSubject('');
      setSupportMsg('');
      setActiveModal(null);
    } catch (err) {
      toast.error(calmError(err, "Couldn't send your support request. Please try again.")); // v332: no raw error text
    } finally {
      setSendingSupport(false);
    }
  };

  // v353: is the money actually in the payment hold? (same thread fields as dealState.js) — the popup used to say
  // "Budget is held" / "fully bonded" before the brand had paid.
  const isFunded = Boolean(
    thread?.payment_funded === true || thread?.escrow_funded === true || thread?.escrow_hold === true ||
    thread?.deal?.escrow_hold === true || thread?.ugc_order?.escrow_hold === true ||
    thread?.escrow_held_at || thread?.deal?.escrow_hold_at || thread?.ugc_order?.escrow_held_at
  );
  const getStatusDetails = (status) => {
    switch (status) {
      case 'NEGOTIATING':
        return {
          label: "Negotiating Offer",
          color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          desc: "Brand and Creator are discussing the campaign details, requirements, and budget. Safety sign-off is required to finalize negotiations."
        };
      case 'ACTIVE':
        if (!thread.agreement_signed_brand || !thread.agreement_signed_creator) {
          return {
            label: "Awaiting Signatures",
            color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
            desc: "The custom collaboration terms are accepted! Both parties must execute the legal contract using the portal to begin content submissions."
          };
        }
        if (!isFunded) { // v353
          return { label: "Waiting for payment", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "Both sides signed. The brand now puts the money in the secure payment hold, then the creator starts." };
        }
        return {
          label: "Creator is working on it",
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          desc: "The agreement is fully signed. The creator is making the content. The money is safe in the Ybex secure payment hold."
        };
      // v353: the real states the server writes (they used to show as raw codes like "Revision req").
      case 'NEGOTIATING_COUNTER':
        return { label: "New price offered", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "A new price was sent. Accept it or reply with your price in the chat." };
      case 'AI_AGREEMENT_READY':
        return { label: "Ready to sign", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", desc: "The price is agreed. Both sides now sign the agreement with an email OTP." };
      case 'AGREEMENT_SIGNED':
        return { label: "One side signed", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", desc: "One side has signed the agreement. Waiting for the other side to sign." };
      case 'SUBMITTED':
        return { label: "Draft sent for review", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", desc: "The creator sent the draft. The brand approves it or asks for changes." };
      case 'REVISION_REQ':
        return { label: "Changes asked", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "The brand asked for changes. The creator sends a new draft." };
      case 'REVISION_DECLINED': case 'REVISION_DECLINED_LINKS':
        return { label: "Changes declined", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "The creator declined the changes. Waiting for the brand to respond." };
      case 'REVISION_REQUESTED_LINKS':
        return { label: "Link needs fixing", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "The brand asked the creator to fix the live link." };
      case 'APPROVED':
        return {
          label: "Content Approved",
          color: "text-green-400 bg-green-500/10 border-green-500/20",
          desc: "Sponsorship content has been reviewed and accepted by the brand. The platform is ready to release the payout."
        };
      case 'COMPLETED':
        return {
          label: "Completed",
          color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
          desc: "Deal completed! Funds from the secure payment hold were released to the creator. Thank you for collaborating."
        };
      // Session 58 (Ravi: "burger menu ke 4 option dummy lagte hai"): the deal flow's real steps, so the
      // status popup says where the deal actually is instead of a raw code.
      case 'PAYMENT_PENDING': case 'AWAITING_PAYMENT': case 'SIGNED':
        return { label: "Waiting for payment", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "Both sides signed. The brand now puts the money in the secure payment hold, then the creator starts." };
      case 'ESCROW_HELD': case 'FUNDED': case 'IN_PROGRESS':
        return { label: "Creator is working on it", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", desc: "The money is safe in the secure payment hold. The creator is making the content." };
      case 'CONTENT_SUBMITTED': case 'DRAFT_SUBMITTED':
        return { label: "Draft sent for review", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", desc: "The creator sent the draft. The brand approves it or asks for changes." };
      case 'REVISION_REQUESTED': case 'CHANGES_REQUESTED':
        return { label: "Changes asked", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "The brand asked for changes. The creator sends a new draft." };
      case 'CONTENT_APPROVED':
        return { label: "Draft approved — post it", color: "text-green-500 bg-green-500/10 border-green-500/20", desc: "The brand approved the draft. The creator posts it and shares the live link." };
      case 'PROOF_SUBMITTED': case 'LINKS_UNDER_REVIEW':
        return { label: "Live link in review", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", desc: "The creator shared the live post link. When the brand approves it, the payment is released to the creator." };
      case 'LINK_CORRECTION_REQUESTED':
        return { label: "Link needs fixing", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", desc: "The brand asked the creator to fix the live link." };
      case 'CANCELLED': case 'DECLINED': case 'REJECTED':
        return { label: "Closed", color: "text-rose-500 bg-rose-500/10 border-rose-500/20", desc: "This collaboration was closed. Any money in the payment hold goes back as per the refund rules." };
      default:
        return {
          label: status ? String(status).replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "In Progress",
          color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
          desc: "Current execution status of this platform collaboration."
        };
    }
  };

  const statusInfo = getStatusDetails(String(thread?.flow_state || thread?.deal_status || thread?.status || '').toUpperCase() || undefined);

  return (
    <div className="relative">
      {/* Burger Button */}
      {/* v332: the support form fields use 16px text on phones (smaller text made iPhones zoom in) */}
      <button 
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Open collaboration menu"
        aria-expanded={isOpen}
        style={{ touchAction: "manipulation" }}
        className="p-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--border-strong)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center border border-[var(--border-default)]"
        title="Collaboration Menu"
      >
        <Menu size={20} />
      </button>

      {/* Dropdown Menu — Session 43 (Ravi/Jatin: "hamburger not working, app freezes"): the
          tap-outside layer sat in an AnimatePresence fragment and could stay on screen after the
          menu closed, eating every tap. Now it is a plain layer that exists only while open, and
          the menu is drawn in <body> (fixed, under the button) so no parent can clip or cover it. */}
      {isOpen && menuPos && createPortal(
        <div className="fixed inset-0 z-[1000]" onClick={() => setIsOpen(false)} data-testid="burger-menu-backdrop">
            <motion.div 
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
              className="w-72 max-w-[calc(100vw-24px)] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden"
              data-testid="burger-menu"
            >
              <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/30">
                <span className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider block">Ybex Suite Menu</span>
                <span className="text-sm font-bold text-[var(--text-primary)] truncate block">{campaign?.title || thread?.campaign_title || thread?.ugc_order?.title || 'Direct Collaboration' /* v332: UGC / campaign-title threads said "Direct Collaboration" */}</span>
              </div>

              <div className="p-2 space-y-1">
                {/* 1. Campaign Status */}
                <button 
                  onClick={() => { setActiveModal('status'); setIsOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium text-sm rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="text-amber-500" />
                    <span>{isUgc ? "Order status" : "Campaign Status"}</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </button>

                {/* 2. Campaign Details */}
                <button 
                  onClick={() => { setActiveModal('details'); setIsOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium text-sm rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Info size={16} className="text-[var(--violet)]" />
                    <span>{detailsLabel}</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </button>

                {/* 3. Contact Details */}
                <button 
                  onClick={() => { setActiveModal('contacts'); setIsOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium text-sm rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-emerald-500" />
                    <span>Partner details</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </button>

                {/* 4. Contact Support */}
                <button 
                  onClick={() => { setActiveModal('support'); setIsOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium text-sm rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle size={16} className="text-rose-500" />
                    <span>Contact Support</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </button>

                {/* 5. v337: Block the other person (App Store 1.2) */}
                <BlockUserButton
                  variant="menu"
                  targetId={isBrand ? (creator?.user_id || thread?.creator_id) : (brand?.user_id || thread?.brand_id)}
                  name={isBrand ? (creator?.name || "") : (brand?.name || brand?.company_name || "")}
                  onChange={() => setIsOpen(false)}
                />
              </div>

              <div className="p-4 bg-[var(--bg-elevated)]/30 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                🛡️ Agreements signed here are valid e-contracts (<b className="font-semibold">Section 10A, IT Act 2000</b>). The secure payment hold protects both sides.
              </div>
            </motion.div>
        </div>,
        document.body
      )}

      {/* Modals rendered via React Portal to prevent layout cut-off */}
      {createPortal(
        <AnimatePresence>
          {/* 1. STATUS MODAL */}
          {activeModal === 'status' && (
            <div 
              className="fixed inset-0 z-[1100] overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setActiveModal(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl w-full max-w-md p-6 relative shadow-2xl space-y-4 text-[var(--text-primary)] max-h-[85vh] overflow-y-auto"
              >
                <button type="button" aria-label="Close" /* v332 */ onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-elevated)]"><X size={18}/></button>
                <h4 className="text-lg font-display font-bold text-[var(--text-primary)]">Collaboration Status</h4>
                
                <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Current State:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {statusInfo.desc}
                  </p>
                </div>

                <div className="space-y-2 text-xs text-[var(--text-tertiary)] leading-relaxed border-t border-[var(--border-default)] pt-3">
                  {isFunded && Number(thread.agreed_amount) > 0 && ( /* v353: only once the brand has actually paid */
                    <p>• In the secure payment hold: <strong className="text-[var(--violet)]">₹{Number(thread.agreed_amount).toLocaleString('en-IN')}</strong></p>
                  )}
                  <p>• Content submissions are automatically reviewed by system scanners for compliance guidelines.</p>
                </div>
              </motion.div>
            </div>
          )}

          {/* 2. DETAILS MODAL */}
          {activeModal === 'details' && (
            <div 
              className="fixed inset-0 z-[1100] overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setActiveModal(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col max-h-[85vh] text-[var(--text-primary)]"
              >
                <button type="button" aria-label="Close" /* v332 */ onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-elevated)]"><X size={18}/></button>
                <h4 className="text-xl font-display font-bold text-[var(--text-primary)] mb-4">{detailsLabel}</h4>
                
                <div className="overflow-y-auto space-y-4 pr-1 no-scrollbar flex-1">
                  <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-[var(--violet)] uppercase tracking-wider block">{titleLabel}</span>
                    <h5 className="text-base font-bold text-[var(--text-primary)]">{(typeof campaign.title === 'string' && campaign.title) || (typeof campaign.product_name === 'string' && campaign.product_name) || (typeof thread?.title === 'string' && thread.title) || (isUgc ? 'UGC Video Collaboration' : 'Direct Sponsorship')}</h5>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {(typeof campaign.description === 'string' && campaign.description) ||
                       (typeof campaign.product_description === 'string' && campaign.product_description) ||
                       (typeof campaign.detailed_requirements === 'string' && campaign.detailed_requirements) ||
                       (isUgc ? 'No brief description provided.' : 'No campaign description provided.')}
                    </p>
                  </div>

                  {campaign.deliverable_type && typeof campaign.deliverable_type === 'string' && (
                    <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl p-4">
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block mb-1">Deliverable Format</span>
                      <p className="text-sm text-[var(--text-primary)] font-semibold capitalize">{campaign.deliverable_type.replace(/_/g, ' ') /* v353: every underscore */}</p>
                    </div>
                  )}

                  {/* v353: the "Brand Platform Fee ₹0 (Zero Fee)" row is gone — fees are shown in the agreement and payout card */}

                  <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Deliverables list</span>
                    <ul className="text-xs text-[var(--text-secondary)] list-disc pl-5 space-y-1.5">
                      {thread.deliverables && thread.deliverables.length > 0 ? (
                        thread.deliverables.map((d, i) => <li key={i}>{d}</li>)
                      ) : (
                        <li>{isUgc ? 'Standard UGC deliverables' : 'Standard campaign deliverables'}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 3. CONTACT DETAILS MODAL */}
          {activeModal === 'contacts' && (
            <div 
              className="fixed inset-0 z-[1100] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setActiveModal(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl w-full max-w-md p-5 relative shadow-2xl space-y-3 text-[var(--text-primary)] max-h-[85vh] overflow-y-auto"
              >
                <button type="button" aria-label="Close" /* v332 */ onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"><X size={16}/></button>
                <h4 className="text-base font-bold text-[var(--text-primary)]">Partner details</h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Phone numbers, emails and social handles stay private on Ybex. Talk here in the chat so your payment stays protected.</p>

                {isBrand ? (
                  /* Brand viewing Creator contact details */
                  <div className="space-y-3 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--violet-soft)] text-[var(--violet)] rounded-xl flex items-center justify-center shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase block font-bold">Creator</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{creator.name || 'Creator'}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--border-default)] text-xs">
                      {/* Session 43 (Ravi): no Instagram handle here — it is a way to move the talk off
                          Ybex, which the chat blocks. The public Ybex profile shows their content. */}
                      {creatorProfile.category && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <MapPin size={14} className="text-teal-500" />
                          <span>Niche: {creatorProfile.category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Creator viewing Brand contact details */
                  <div className="space-y-3 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--violet-soft)] text-[var(--violet)] rounded-xl flex items-center justify-center shrink-0">
                        <Building size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase block font-bold">Brand Partner</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{brand.name || 'Brand'}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--border-default)] text-xs">
                      {brand.website && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <Globe size={14} className="text-teal-500" />
                          <span>{brand.website}</span>
                        </div>
                      )}
                      {brand.profile?.address && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <MapPin size={14} className="text-amber-500" />
                          <span className="truncate">{brand.profile.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* 4. CONTACT SUPPORT MODAL */}
          {activeModal === 'support' && (
            <div 
              className="fixed inset-0 z-[1100] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setActiveModal(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl w-full max-w-md p-5 relative shadow-2xl text-[var(--text-primary)] max-h-[85vh] overflow-y-auto"
              >
                <button type="button" aria-label="Close" /* v332 */ onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"><X size={16}/></button>
                
                <h4 className="text-base font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                  <HelpCircle size={18} className="text-[var(--violet)]" /> Help & Support
                </h4>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Raise a support request for mediation, milestone assistance, or platform help.
                </p>

                <form onSubmit={handleContactSupportSubmit} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1 uppercase tracking-wider">Subject</label>
                    <input 
                      type="text"
                      required
                      value={supportSubject}
                      onChange={e => setSupportSubject(e.target.value)}
                      placeholder="e.g. Milestone query, scope assistance"
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-base md:text-xs rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--violet)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1 uppercase tracking-wider">Message</label>
                    <textarea 
                      required
                      value={supportMsg}
                      onChange={e => setSupportMsg(e.target.value)}
                      rows={3}
                      placeholder="Describe your query or issue..."
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-base md:text-xs rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--violet)] resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={sendingSupport}
                    className="w-full py-2.5 bg-[var(--violet)] hover:bg-[var(--violet-hover)] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send size={13} /> {sendingSupport ? 'Submitting ticket...' : 'Submit Support Ticket'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
