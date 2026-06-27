"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, Clock, Search } from "lucide-react";

interface OverlordReport {
  id: string;
  pet_name: string;
  pet_type: "cat" | "dog";
  status: "active" | "resolved";
  photos: string[];
  last_seen_at: string;
  last_seen_lat: number;
  last_seen_lng: number;
  description: string;
  created_at: string;
}

interface AgentReport {
  id: string;
  pet_type: "cat" | "dog";
  status: "active" | "resolved";
  photos: string[];
  sighted_at: string;
  sighting_lat: number;
  sighting_lng: number;
  description: string;
  created_at: string;
}

type TabType = "lost" | "found";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("lost");
  const [overlords, setOverlords] = useState<OverlordReport[]>([]);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [overlordRes, agentRes] = await Promise.all([
        fetch("/api/overlords?status=active"),
        fetch("/api/agents?status=active"),
      ]);

      if (!overlordRes.ok || !agentRes.ok) {
        throw new Error("Failed to fetch reports");
      }

      const overlordData = await overlordRes.json();
      const agentData = await agentRes.json();

      setOverlords(overlordData.overlords ?? []);
      setAgents(agentData.agents ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <header>
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold uppercase tracking-wider text-sidebar-active">
          Active Reports
        </h1>
        <p className="mt-1 text-xs font-mono uppercase tracking-wide text-text-secondary">
          All active lost &amp; found reports in the network
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-[3px] border-border">
        <button
          onClick={() => setActiveTab("lost")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all ${
            activeTab === "lost"
              ? "bg-danger/10 text-danger border-r-[3px] border-border"
              : "text-text-secondary hover:bg-card border-r-[3px] border-border"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Lost ({overlords.length})
        </button>
        <button
          onClick={() => setActiveTab("found")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all ${
            activeTab === "found"
              ? "bg-success/10 text-success"
              : "text-text-secondary hover:bg-card"
          }`}
        >
          <Eye className="h-4 w-4" />
          Found ({agents.length})
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[2px] border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 border-[3px] border-danger bg-card p-6">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <p className="text-sm text-text-primary">{error}</p>
          <button
            onClick={fetchReports}
            className="min-h-[44px] border-[3px] border-accent bg-accent/10 px-4 py-2 text-sm font-bold uppercase text-accent shadow-[3px_3px_0px_0px] shadow-accent/40 hover:bg-accent/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* Lost Reports List */}
      {!isLoading && !error && activeTab === "lost" && (
        <div className="space-y-3">
          {overlords.length === 0 ? (
            <div className="flex flex-col items-center gap-4 border-[3px] border-border bg-card p-10">
              <Search className="h-8 w-8 text-text-secondary" />
              <p className="font-mono text-sm text-text-secondary">
                NO ACTIVE LOST REPORTS
              </p>
            </div>
          ) : (
            overlords.map((report) => (
              <Link
                key={report.id}
                href={`/overlords/${report.id}`}
                className="flex items-center gap-4 border-[3px] border-border bg-card p-4 transition-all hover:border-danger/50 hover:shadow-[3px_3px_0px_0px] hover:shadow-danger/30"
              >
                {/* Photo */}
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden border-[2px] border-border bg-background">
                  {report.photos[0] ? (
                    <img
                      src={report.photos[0]}
                      alt={report.pet_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-secondary text-lg">
                      🐾
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {report.pet_name}
                    </p>
                    <span className="rounded-[2px] bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase text-danger">
                      {report.pet_type}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-1">
                      {report.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-text-secondary font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(report.last_seen_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <span className="flex-shrink-0 rounded-[2px] bg-danger/10 px-2 py-1 font-mono text-[10px] uppercase text-danger border border-danger/30">
                  MISSING
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Found Reports List */}
      {!isLoading && !error && activeTab === "found" && (
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center gap-4 border-[3px] border-border bg-card p-10">
              <Search className="h-8 w-8 text-text-secondary" />
              <p className="font-mono text-sm text-text-secondary">
                NO ACTIVE FOUND REPORTS
              </p>
            </div>
          ) : (
            agents.map((report) => (
              <Link
                key={report.id}
                href={`/agents/${report.id}`}
                className="flex items-center gap-4 border-[3px] border-border bg-card p-4 transition-all hover:border-success/50 hover:shadow-[3px_3px_0px_0px] hover:shadow-success/30"
              >
                {/* Photo */}
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden border-[2px] border-border bg-background">
                  {report.photos[0] ? (
                    <img
                      src={report.photos[0]}
                      alt="Spotted pet"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-secondary text-lg">
                      🐾
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-text-primary">
                      Spotted {report.pet_type === "cat" ? "Cat" : "Dog"}
                    </p>
                    <span className="rounded-[2px] bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase text-success">
                      {report.pet_type}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-1">
                      {report.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-text-secondary font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(report.sighted_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <span className="flex-shrink-0 rounded-[2px] bg-success/10 px-2 py-1 font-mono text-[10px] uppercase text-success border border-success/30">
                  SPOTTED
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
