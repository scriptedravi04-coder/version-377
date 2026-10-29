import React from "react";
import { X, Plus } from "lucide-react";


// Session 49 (clean-up): moved out of CreatorMobileProfile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function LanguagesField(props) {
  const { availableLanguages, editForm, selectedLanguages, setEditForm } = props;
  return (
    <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Languages Spoken
            </label>
            <div className="flex flex-wrap gap-2">
              {/* Selected Solid Purple Chips */}
              {selectedLanguages.map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-9 rounded-full text-xs font-extrabold bg-[#7C3AED] text-white shadow-xs"
                >
                  {lang}
                  {selectedLanguages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm({
                          ...editForm,
                          languages: selectedLanguages.filter(l => l !== lang)
                        });
                      }}
                      aria-label={`Remove ${lang}`} /* v330: icon-only button */
                      className="w-8 h-8 -my-1 -mr-2.5 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors" /* v353: 32px+ tap area */
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}

              {/* Available Unselected Options */}
              {/* v353: every language (was only the first 6 — Tamil, Telugu… could never be added) */}
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setEditForm({
                      ...editForm,
                      languages: [...selectedLanguages, lang]
                    });
                  }}
                  className="inline-flex items-center gap-1 px-3 min-h-9 rounded-full text-xs font-bold bg-[#F9F9FB] border border-[#EDEDF2] text-slate-600 hover:border-slate-300 active:scale-95 transition-all"
                >
                  <Plus size={12} /> {lang}
                </button>
              ))}
            </div>
          </div>
  );
}
