import React, { useState } from "react";

interface LiveBrowserViewProps {
  cashUrl: string | null;
  awardUrl: string | null;
}

interface PaneProps {
  label: string;
  url: string;
  fullWidth: boolean;
}

const BrowserPane: React.FC<PaneProps> = ({ label, url, fullWidth }) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) return null;

  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-primary">{label}</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          Live
        </span>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-default bg-surface" style={{ height: 350 }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            <div className="h-6 w-6 border-2 border-default border-t-primary rounded-full animate-spin" />
          </div>
        )}
        <iframe
          src={url}
          className="w-full h-full"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
};

export const LiveBrowserView: React.FC<LiveBrowserViewProps> = ({ cashUrl, awardUrl }) => {
  const hasCash = !!cashUrl;
  const hasAward = !!awardUrl;

  if (!hasCash && !hasAward) return null;

  const bothVisible = hasCash && hasAward;

  return (
    <div className={`grid gap-3 ${bothVisible ? "grid-cols-2" : "grid-cols-1"}`}>
      {hasCash && (
        <BrowserPane label="Cash Price Search" url={cashUrl} fullWidth={!bothVisible} />
      )}
      {hasAward && (
        <BrowserPane label="Award Miles Search" url={awardUrl} fullWidth={!bothVisible} />
      )}
    </div>
  );
};
