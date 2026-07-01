"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Eye,
  Clock,
  Search,
  Filter,
  MapPin,
} from "lucide-react";

interface OverlordReport {
  id: string;
  owner_id: string;
  pet_name: string;
  pet_type: "cat" | "dog";
  status: "active" | "resolved";
  photos: string[];
  last_seen_at: string;
  last_seen_lat: number;
  last_seen_lng: number;
  last_seen_address: string | null;
  description: string;
  created_at: string;
}

interface AgentReport {
  id: string;
  reporter_id: string;
  pet_type: "cat" | "dog";
  status: "active" | "resolved";
  photos: string[];
  sighted_at: string;
  sighting_lat: number;
  sighting_lng: number;
  sighting_address: string | null;
  description: string;
  created_at: string;
}

type TabType = "lost" | "found";
type OwnerFilter = "all" | "mine";
type PetFilter = "all" | "cat" | "dog";
type StatusFilter = "active" | "resolved" | "all";
type TimeFilter = "all" | "7d" | "30d";

function isoSince(filter: TimeFilter): string | null {
  if (filter === "all") return null;
  const now = new Date();
  const days = filter === "7d" ? 7 : 30;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function buildQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * A small toggle-pill row used across all filter groups.
 * Keeps the filter UI consistent and accessible (radiogroup semantics).
 */
function FilterGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={
                "px-3 py-1.5 text-xs font-medium rounded-full transition-all border " +
                (selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-text-secondary hover:border-primary/50 hover:text-primary")
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("lost");

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [petFilter, setPetFilter] = useState<PetFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const [overlords, setOverlords] = useState<OverlordReport[]>([]);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    return buildQuery({
      status: statusFilter === "all" ? undefined : statusFilter,
      mine: ownerFilter === "mine" ? "true" : undefined,
      pet_type: petFilter === "all" ? undefined : petFilter,
      since: isoSince(timeFilter) ?? undefined,
    });
  }, [ownerFilter, petFilter, statusFilter, timeFilter]);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [overlordRes, agentRes] = await Promise.all([
        fetch(`/api/overlords${queryString}`),
        fetch(`/api/agents${queryString}`),
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
  }, [queryString]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const activeFilterCount =
    (ownerFilter !== "all" ? 1 : 0) +
    (petFilter !== "all" ? 1 : 0) +
    (statusFilter !== "active" ? 1 : 0) +
    (timeFilter !== "all" ? 1 : 0);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <header>
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-text-primary">
          Reports
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Browse missing pet reports and sightings from the community
        </p>
      </header>

      {/* Filter Bar */}
      <section
        aria-label="Report filters"
        className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-primary">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="ml-auto text-xs text-primary">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterGroup
            label="Reporter"
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={[
              { value: "all", label: "Everyone" },
              { value: "mine", label: "Mine" },
            ]}
          />
          <FilterGroup
            label="Pet type"
            value={petFilter}
            onChange={setPetFilter}
            options={[
              { value: "all", label: "All" },
              { value: "cat", label: "Cat" },
              { value: "dog", label: "Dog" },
            ]}
          />
          <FilterGroup
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: "Active" },
              { value: "resolved", label: "Resolved" },
              { value: "all", label: "All" },
            ]}
          />
          <FilterGroup
            label="Time"
            value={timeFilter}
            onChange={setTimeFilter}
            options={[
              { value: "all", label: "Any time" },
              { value: "7d", label: "Last 7d" },
              { value: "30d", label: "Last 30d" },
            ]}
          />
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => setActiveTab("lost")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "lost"
              ? "bg-danger/10 text-danger"
              : "text-text-secondary hover:bg-muted"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Missing ({overlords.length})
        </button>
        <button
          onClick={() => setActiveTab("found")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "found"
              ? "bg-success/10 text-success"
              : "text-text-secondary hover:bg-muted"
          }`}
        >
          <Eye className="h-4 w-4" />
          Sightings ({agents.length})
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/40 bg-card p-6 shadow-[var(--shadow-soft)]">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <p className="text-sm text-text-primary">{error}</p>
          <button
            onClick={fetchReports}
            className="min-h-[40px] rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* Lost Reports List */}
      {!isLoading && !error && activeTab === "lost" && (
        <div className="space-y-3">
          {overlords.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 shadow-[var(--shadow-soft)]">
              <Search className="h-8 w-8 text-text-secondary" />
              <p className="text-sm text-text-secondary">
                No missing pet reports match your filters
              </p>
            </div>
          ) : (
            overlords.map((report) => (
              <Link
                key={report.id}
                href={`/overlords/${report.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-danger/50 hover:shadow-[var(--shadow-md)]"
              >
                {/* Photo */}
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
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
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {report.pet_name}
                    </p>
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                      {report.pet_type}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-1">
                      {report.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <Clock className="h-3 w-3" />
                      {new Date(report.last_seen_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </span>
                    {report.last_seen_address && (
                      <span className="flex items-center gap-1 text-xs text-text-secondary/90 truncate max-w-[200px]">
                        <MapPin className="h-3 w-3 text-danger/70" />
                        {report.last_seen_address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    report.status === "active"
                      ? "bg-danger/10 text-danger"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {report.status === "active" ? "Missing" : "Home"}
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
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 shadow-[var(--shadow-soft)]">
              <Search className="h-8 w-8 text-text-secondary" />
              <p className="text-sm text-text-secondary">
                No sightings match your filters
              </p>
            </div>
          ) : (
            agents.map((report) => (
              <Link
                key={report.id}
                href={`/agents/${report.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-success/50 hover:shadow-[var(--shadow-md)]"
              >
                {/* Photo */}
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
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
                    <p className="text-sm font-semibold text-text-primary">
                      Spotted {report.pet_type === "cat" ? "cat" : "dog"}
                    </p>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                      {report.pet_type}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-1">
                      {report.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <Clock className="h-3 w-3" />
                      {new Date(report.sighted_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </span>
                    {report.sighting_address && (
                      <span className="flex items-center gap-1 text-xs text-text-secondary/90 truncate max-w-[200px]">
                        <MapPin className="h-3 w-3 text-success/70" />
                        {report.sighting_address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    report.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-muted text-text-secondary"
                  }`}
                >
                  {report.status === "active" ? "Sighting" : "Resolved"}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
