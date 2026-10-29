import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, RefreshCw, X } from "lucide-react";


// Session 49 (clean-up): moved out of BrandUGCMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function AiPromptSheet(props) {
  const { aiGenerating, handleGenerateWithAi, postData, setShowAiAssist, showAiAssist } = props;
  return (
    <AnimatePresence>
          {showAiAssist && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowAiAssist(false)} 
                className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
              />
              <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }} 
                className="relative bg-white w-full max-w-lg rounded-t-[28px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 space-y-4 max-h-[85vh] max-h-[85dvh] overflow-y-auto" /* v330 */
              >
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center">
                      <Lightbulb size={16} />
                    </div>
                    <h3 className="text-base font-bold text-[#0A0A0A]">AI UGC Brief Generator</h3>
                  </div>
                  <button onClick={() => setShowAiAssist(false)} aria-label="Close" className="text-gray-400 w-10 h-10 -mr-2 flex items-center justify-center">{/* v330 */}
                    <X size={20} />
                  </button>
                </div>

                <p className="text-xs text-[#6B7280]">
                  Pick a niche template or generate custom requirements with Ybex Eva.{/* v330: our assistant is Ybex Eva, not "Gemini AI" */}
                </p>

                {/* Category Preset chips */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Skincare Glow Routine", prompt: "Skincare serum hydrating detan" },
                    { label: "D2C Snack / Drink", prompt: "Healthy organic energy beverage" },
                    { label: "Fitness & Gym Wear", prompt: "Athleisure gym compression activewear" },
                    { label: "Tech / App Review", prompt: "Mobile app fintech productivity tool" }
                  ].map(cat => (
                    <button
                      key={cat.label}
                      disabled={aiGenerating}
                      onClick={() => handleGenerateWithAi(cat.prompt)}
                      className="p-3 rounded-xl border border-[#E5E5EA] bg-[#F9F9FB] text-left hover:border-[#7C3AED] hover:bg-[#F8F4FF] transition-all disabled:opacity-50"
                    >
                      <span className="text-xs font-bold text-[#0A0A0A] block">{cat.label}</span>
                      <span className="text-[10px] text-[#7C3AED] font-semibold">Generate →</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    disabled={aiGenerating}
                    onClick={() => handleGenerateWithAi(postData.product_name || postData.title)}
                    className="w-full py-3.5 bg-[#7C3AED] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {aiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                    Generate from Current Form
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
}
