import { type ReactNode } from 'react';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  children: ReactNode;
}

export const Tabs = ({ tabs, activeTab, onChange, children }: TabsProps) => {
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div role="tablist" className="inline-flex p-1 bg-slate-900/80 border border-white/[0.08] rounded-2xl gap-1 shadow-inner">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(tab.key)}
                onKeyDown={(e) => {
                  const currentIndex = tabs.findIndex((t) => t.key === activeTab);
                  let nextIndex = currentIndex;

                  if (e.key === 'ArrowRight') {
                    nextIndex = (currentIndex + 1) % tabs.length;
                  } else if (e.key === 'ArrowLeft') {
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                  } else if (e.key === 'Home') {
                    nextIndex = 0;
                  } else if (e.key === 'End') {
                    nextIndex = tabs.length - 1;
                  } else {
                    return;
                  }

                  e.preventDefault();
                  onChange(tabs[nextIndex].key);
                  document.getElementById(`tab-${tabs[nextIndex].key}`)?.focus();
                }}
                className={`whitespace-nowrap py-2 px-3.5 sm:px-4 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 select-none ${
                  isActive
                    ? 'bg-white/[0.1] text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
};

interface TabPanelProps {
  value: string;
  activeTab: string;
  children: ReactNode;
}

export const TabPanel = ({ value, activeTab, children }: TabPanelProps) => {
  if (value !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
};
