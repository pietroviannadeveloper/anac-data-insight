"use client";

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> deve ser usado dentro de <Tabs>`);
  return ctx;
}

export function Tabs({
  defaultTab,
  className = "",
  children,
}: {
  defaultTab: string;
  className?: string;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(currentIndex + delta + tabs.length) % tabs.length];
    next.focus();
    next.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function Tab({
  id,
  disabled = false,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { activeTab, setActiveTab, baseId } = useTabsContext("Tab");
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(id)}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
        disabled
          ? "opacity-30 cursor-not-allowed border-white/10 text-white/30"
          : isActive
          ? "bg-[#003A70]/40 border-blue-400/50 text-blue-100 ring-1 ring-inset ring-blue-400/40"
          : "border-white/8 bg-white/4 text-blue-100/50 hover:text-blue-100/80 hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { activeTab, baseId } = useTabsContext("TabPanel");
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
