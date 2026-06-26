/**
 * MEOWTRIX Seed Data Script
 *
 * Populates the database with realistic demonstration data including:
 * - 5 Informants with realistic display names and residential areas
 * - 15 Overlords (lost cats) with varying statuses
 * - 10 Agents (found/spotted cats)
 * - Pre-generated trait tags for all records
 * - 3 match suggestions with scores: 85, 72, 55
 * - 2 leaderboard entries with points
 *
 * All records are marked with is_seed: true for easy identification and cleanup.
 *
 * Environment variables:
 *   SEED_DATA=true        — Auto-seed on execution
 *   SEED_CLEANUP=true     — Remove all seed data instead of seeding
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase service role client (bypasses RLS)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Seed data constants
// ---------------------------------------------------------------------------

// Bangkok area coordinates for a geographically coherent area
const BANGKOK_CENTER = { lat: 13.7563, lng: 100.5018 };

const INFORMANT_SEEDS = [
  {
    email: "somchai@meowtrix.demo",
    display_name: "Agent Somchai",
    residential_area: "Silom, Bangkok",
    residential_lat: 13.7278,
    residential_lng: 100.5236,
    location_consent: true,
    total_points: 30,
    successful_matches: 3,
    first_match_at: "2024-11-15T10:00:00Z",
  },
  {
    email: "nattaya@meowtrix.demo",
    display_name: "Operative Nattaya",
    residential_area: "Chatuchak, Bangkok",
    residential_lat: 13.7999,
    residential_lng: 100.5533,
    location_consent: true,
    total_points: 20,
    successful_matches: 2,
    first_match_at: "2024-11-20T14:30:00Z",
  },
  {
    email: "tanakorn@meowtrix.demo",
    display_name: "Handler Tanakorn",
    residential_area: "Sukhumvit, Bangkok",
    residential_lat: 13.7367,
    residential_lng: 100.5608,
    location_consent: true,
    total_points: 0,
    successful_matches: 0,
    first_match_at: null,
  },
  {
    email: "ploy@meowtrix.demo",
    display_name: "Spymaster Ploy",
    residential_area: "Thonglor, Bangkok",
    residential_lat: 13.7316,
    residential_lng: 100.5789,
    location_consent: true,
    total_points: 0,
    successful_matches: 0,
    first_match_at: null,
  },
  {
    email: "krit@meowtrix.demo",
    display_name: "Recon Krit",
    residential_area: "Ari, Bangkok",
    residential_lat: 13.7851,
    residential_lng: 100.5448,
    location_consent: false,
    total_points: 0,
    successful_matches: 0,
    first_match_at: null,
  },
];

const TRAIT_TAGS_POOL = [
  {
    primary_color: "orange",
    secondary_color: "white",
    pattern_type: "tabby",
    fur_length: "short",
    breed_estimate: "Domestic Shorthair",
    distinguishing_features: ["green eyes", "notched left ear", "striped tail", "white chest patch", "round face"],
  },
  {
    primary_color: "black",
    secondary_color: null,
    pattern_type: "solid",
    fur_length: "medium",
    breed_estimate: "Bombay",
    distinguishing_features: ["golden eyes", "sleek coat", "muscular build", "long tail", "small ears"],
  },
  {
    primary_color: "white",
    secondary_color: "gray",
    pattern_type: "bicolor",
    fur_length: "long",
    breed_estimate: "Persian",
    distinguishing_features: ["blue eyes", "flat face", "fluffy tail", "short legs", "bushy whiskers"],
  },
  {
    primary_color: "brown",
    secondary_color: "black",
    pattern_type: "tabby",
    fur_length: "short",
    breed_estimate: "Bengal",
    distinguishing_features: ["spotted pattern", "large ears", "muscular body", "green eyes", "whip tail"],
  },
  {
    primary_color: "cream",
    secondary_color: "brown",
    pattern_type: "pointed",
    fur_length: "short",
    breed_estimate: "Siamese",
    distinguishing_features: ["blue eyes", "dark face mask", "slim body", "large ears", "vocal"],
  },
  {
    primary_color: "calico",
    secondary_color: null,
    pattern_type: "calico",
    fur_length: "medium",
    breed_estimate: "Domestic Shorthair",
    distinguishing_features: ["orange patches", "white belly", "green eyes", "medium build", "short whiskers"],
  },
  {
    primary_color: "gray",
    secondary_color: "white",
    pattern_type: "tuxedo",
    fur_length: "short",
    breed_estimate: "Russian Blue mix",
    distinguishing_features: ["silver coat", "green eyes", "white bib", "graceful gait", "pointed ears"],
  },
  {
    primary_color: "tortoiseshell",
    secondary_color: null,
    pattern_type: "tortoiseshell",
    fur_length: "medium",
    breed_estimate: "unknown",
    distinguishing_features: ["mixed patches", "amber eyes", "compact body", "kinked tail", "loud purr"],
  },
  {
    primary_color: "white",
    secondary_color: "orange",
    pattern_type: "bicolor",
    fur_length: "short",
    breed_estimate: "Turkish Van",
    distinguishing_features: ["odd eyes", "color on tail", "athletic build", "soft coat", "friendly"],
  },
  {
    primary_color: "black",
    secondary_color: "white",
    pattern_type: "tuxedo",
    fur_length: "short",
    breed_estimate: "Domestic Shorthair",
    distinguishing_features: ["white paws", "black mask", "long whiskers", "alert ears", "stocky build"],
  },
];

const PET_NAMES = [
  "Shadow Commander",
  "General Whiskers",
  "Colonel Fluffington",
  "Agent Mittens",
  "Captain Purrcival",
  "Sergeant Noodles",
  "Lieutenant Mochi",
  "Corporal Biscuit",
  "Major Socks",
  "Admiral Tuna",
  "Private Snuggles",
  "Brigadier Cheddar",
  "Marshal Pepper",
  "Commander Tofu",
  "Operator Ginger",
];

const DESCRIPTIONS = [
  "Orange tabby with a distinctive notched left ear. Last seen patrolling the alley behind Soi 11. Very friendly, responds to treat bags.",
  "Sleek all-black cat with piercing golden eyes. Tends to hide in dark corners. Microchipped.",
  "Fluffy white and gray Persian. Indoor cat that escaped through a window. Moves slowly, may be scared.",
  "Athletic Bengal with spotted pattern. Very active, likely roaming far. Wears a blue collar with bell.",
  "Siamese with classic dark points. Extremely vocal, you'll hear him before you see him.",
  "Calico female with distinct orange patches. Senior cat (12 years), may be moving slowly.",
  "Gray and white tuxedo cat with a silver sheen. Elegant mover, might be found near restaurants.",
  "Tortoiseshell female with a kinked tail. Shy around strangers, food-motivated.",
  "White with orange tail and one blue eye. Loves water, might be found near fountains.",
  "Black tuxedo with perfectly white paws. Social butterfly, approaches humans easily.",
  "Large orange male, very friendly. Has a distinctive scar on right ear from past adventures.",
  "Small gray kitten, approximately 6 months old. Still learning to navigate the city.",
  "Muscular brown tabby with tiger-like stripes. Former stray, street-smart and elusive.",
  "Cream colored with chocolate points. Elegant and poised, likes high places.",
  "Petite calico with large green eyes. Skittish but food-motivated. Lost during a move.",
];

// Helper to generate a coordinate offset within ~2km of Bangkok center
function offsetCoord(base: { lat: number; lng: number }, maxKm: number = 5) {
  const latOffset = (Math.random() - 0.5) * (maxKm / 111);
  const lngOffset = (Math.random() - 0.5) * (maxKm / 111);
  return {
    lat: Math.round((base.lat + latOffset) * 10000) / 10000,
    lng: Math.round((base.lng + lngOffset) * 10000) / 10000,
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, "public", any>;

async function checkSeedExists(supabase: AdminClient): Promise<boolean> {
  const { data, error } = await supabase
    .from("informants")
    .select("id")
    .eq("is_seed", true)
    .limit(1);

  if (error) {
    console.error("Error checking for existing seed data:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

async function cleanupSeedData(supabase: AdminClient): Promise<void> {
  console.log("🧹 Cleaning up seed data...");

  // Delete tables with is_seed column. Related records in match_suggestions,
  // claims, and notifications are removed via ON DELETE CASCADE from their
  // parent foreign keys (overlords, agents, informants).
  const seedTables = ["agents", "overlords", "informants"] as const;

  for (const table of seedTables) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("is_seed", true);

    if (error) {
      console.error(`  ❌ Error cleaning ${table}:`, error.message);
    } else {
      console.log(`  ✅ Cleaned ${table} (${count ?? 0} records removed)`);
    }
  }

  // Delete seed auth users
  for (const informant of INFORMANT_SEEDS) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const seedUser = users?.users?.find((u) => u.email === informant.email);
    if (seedUser) {
      await supabase.auth.admin.deleteUser(seedUser.id);
    }
  }
  console.log("  ✅ Cleaned seed auth users");

  // Clean up seed storage files
  const { data: catPhotos } = await supabase.storage.from("cat-photos").list("seed");
  if (catPhotos && catPhotos.length > 0) {
    const paths = catPhotos.map((f) => `seed/${f.name}`);
    await supabase.storage.from("cat-photos").remove(paths);
    console.log(`  ✅ Cleaned ${paths.length} seed photos from storage`);
  }

  console.log("✅ Seed data cleanup complete.");
}

async function seedDatabase(supabase: AdminClient): Promise<void> {
  console.log("🌱 Seeding MEOWTRIX database...");

  // -------------------------------------------------------------------------
  // 1. Create Informant auth users and profiles
  // -------------------------------------------------------------------------
  console.log("  📋 Creating Informants...");

  const informantIds: string[] = [];

  for (const informant of INFORMANT_SEEDS) {
    // Create auth user via admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: informant.email,
      password: "MeowtrixDemo2024!",
      email_confirm: true,
      user_metadata: { display_name: informant.display_name },
    });

    if (authError) {
      // User might already exist if partial seed ran before
      if (authError.message?.includes("already been registered")) {
        console.log(`    ⏭️  Skipping existing user: ${informant.email}`);
        // Try to get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existing = users?.users?.find((u) => u.email === informant.email);
        if (existing) {
          informantIds.push(existing.id);
        }
        continue;
      }
      console.error(`    ❌ Error creating auth user ${informant.email}:`, authError.message);
      continue;
    }

    const userId = authUser.user.id;
    informantIds.push(userId);

    // Create informant profile
    const { error: profileError } = await supabase.from("informants").insert({
      id: userId,
      email: informant.email,
      display_name: informant.display_name,
      residential_area: informant.residential_area,
      residential_lat: informant.residential_lat,
      residential_lng: informant.residential_lng,
      location_consent: informant.location_consent,
      total_points: informant.total_points,
      successful_matches: informant.successful_matches,
      first_match_at: informant.first_match_at,
      is_seed: true,
    });

    if (profileError) {
      console.error(`    ❌ Error creating informant profile ${informant.display_name}:`, profileError.message);
    } else {
      console.log(`    ✅ Created: ${informant.display_name} (${informant.email})`);
    }
  }

  if (informantIds.length < 2) {
    console.error("  ❌ Not enough informants created. Aborting seed.");
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Create Overlords (lost cats)
  // -------------------------------------------------------------------------
  console.log("  🐱 Creating Overlords (lost cats)...");

  const overlordIds: string[] = [];
  const overlordData = [];

  for (let i = 0; i < 15; i++) {
    const ownerId = informantIds[i % informantIds.length];
    const coord = offsetCoord(BANGKOK_CENTER);
    const traitTags = TRAIT_TAGS_POOL[i % TRAIT_TAGS_POOL.length];

    // Determine status: first 10 active, 2 resolved, 3 with pending claims
    let status: "active" | "resolved" = "active";
    if (i >= 10 && i < 12) {
      status = "resolved";
    }

    const lastSeenHoursAgo = i < 5 ? 2 + i * 3 : 24 + i * 6;

    const record = {
      owner_id: ownerId,
      pet_name: PET_NAMES[i],
      description: DESCRIPTIONS[i],
      last_seen_lat: coord.lat,
      last_seen_lng: coord.lng,
      last_seen_at: hoursAgo(lastSeenHoursAgo),
      status,
      photos: [`https://placekitten.com/${400 + i}/${300 + i}`],
      trait_tags: traitTags,
      tagging_status: "complete",
      verification_name: PET_NAMES[i].split(" ").pop() || PET_NAMES[i],
      verification_marking: traitTags.distinguishing_features[0],
      verification_trait: traitTags.distinguishing_features.length > 1
        ? traitTags.distinguishing_features[1]
        : "playful",
      poster_url: status === "active" && lastSeenHoursAgo >= 24 ? `https://storage.example.com/posters/seed-${i}.pdf` : null,
      is_seed: true,
      created_at: hoursAgo(lastSeenHoursAgo + 1),
    };

    overlordData.push(record);
  }

  const { data: insertedOverlords, error: overlordError } = await supabase
    .from("overlords")
    .insert(overlordData)
    .select("id");

  if (overlordError) {
    console.error("    ❌ Error creating overlords:", overlordError.message);
    return;
  }

  for (const o of insertedOverlords || []) {
    overlordIds.push(o.id);
  }
  console.log(`    ✅ Created ${overlordIds.length} Overlords`);

  // -------------------------------------------------------------------------
  // 3. Create Agents (found/spotted cats)
  // -------------------------------------------------------------------------
  console.log("  🔍 Creating Agents (spotted cats)...");

  const agentIds: string[] = [];
  const agentData = [];

  for (let i = 0; i < 10; i++) {
    const reporterId = informantIds[(i + 1) % informantIds.length];
    // Place agents near overlords for some to allow proximity matching
    const baseCoord = i < 5
      ? offsetCoord(BANGKOK_CENTER, 1) // Close to center for better matches
      : offsetCoord(BANGKOK_CENTER, 4); // Further away

    const traitTags = TRAIT_TAGS_POOL[i % TRAIT_TAGS_POOL.length];

    const record = {
      reporter_id: reporterId,
      description: `Spotted a ${traitTags.primary_color} cat near ${
        ["Soi 11", "Chatuchak Market", "Lumpini Park", "BTS Asok", "Thonglor Soi 13",
         "Ari neighborhood", "Silom Road", "Sukhumvit Soi 39", "Victory Monument", "Rama IV"][i]
      }. ${traitTags.distinguishing_features.slice(0, 2).join(", ")}. Appeared ${
        i % 2 === 0 ? "well-fed and friendly" : "cautious but curious"
      }.`,
      sighting_lat: baseCoord.lat,
      sighting_lng: baseCoord.lng,
      sighted_at: hoursAgo(i * 4 + 1),
      status: i < 8 ? "active" : "resolved",
      photos: [`https://placekitten.com/${350 + i}/${250 + i}`],
      trait_tags: traitTags,
      tagging_status: "complete",
      is_seed: true,
      created_at: hoursAgo(i * 4 + 2),
    };

    agentData.push(record);
  }

  const { data: insertedAgents, error: agentError } = await supabase
    .from("agents")
    .insert(agentData)
    .select("id");

  if (agentError) {
    console.error("    ❌ Error creating agents:", agentError.message);
    return;
  }

  for (const a of insertedAgents || []) {
    agentIds.push(a.id);
  }
  console.log(`    ✅ Created ${agentIds.length} Agents`);

  // -------------------------------------------------------------------------
  // 4. Create Match Suggestions (scores: 85, 72, 55)
  // -------------------------------------------------------------------------
  console.log("  🎯 Creating Match Suggestions...");

  if (overlordIds.length >= 3 && agentIds.length >= 3) {
    const matchData = [
      {
        overlord_id: overlordIds[0],
        agent_id: agentIds[0],
        overall_score: 85,
        visual_score: 92,
        description_score: 78,
        proximity_score: 88,
        other_score: 80,
        matched_traits: ["orange", "tabby", "short fur", "green eyes", "notched ear"],
        status: "pending",
      },
      {
        overlord_id: overlordIds[1],
        agent_id: agentIds[1],
        overall_score: 72,
        visual_score: 80,
        description_score: 65,
        proximity_score: 70,
        other_score: 68,
        matched_traits: ["black", "solid", "medium fur", "golden eyes"],
        status: "pending",
      },
      {
        overlord_id: overlordIds[2],
        agent_id: agentIds[2],
        overall_score: 55,
        visual_score: 60,
        description_score: 50,
        proximity_score: 55,
        other_score: 45,
        matched_traits: ["white", "long fur", "blue eyes"],
        status: "pending",
      },
    ];

    const { error: matchError } = await supabase.from("match_suggestions").insert(matchData);

    if (matchError) {
      console.error("    ❌ Error creating match suggestions:", matchError.message);
    } else {
      console.log("    ✅ Created 3 match suggestions (scores: 85, 72, 55)");
    }
  }

  // -------------------------------------------------------------------------
  // 5. Leaderboard entries are already seeded via informant points
  // (Informants 1 and 2 have points set above)
  // -------------------------------------------------------------------------
  console.log("  🏆 Leaderboard entries: Informants 1 & 2 have points (30 and 20)");

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  console.log("");
  console.log("🎉 Seed complete!");
  console.log(`   Informants: ${informantIds.length}`);
  console.log(`   Overlords:  ${overlordIds.length}`);
  console.log(`   Agents:     ${agentIds.length}`);
  console.log(`   Matches:    3`);
  console.log(`   Leaderboard entries: 2 (Agent Somchai: 30pts, Operative Nattaya: 20pts)`);
  console.log("");
  console.log("📝 Demo credentials:");
  console.log("   Email: somchai@meowtrix.demo");
  console.log("   Password: MeowtrixDemo2024!");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load environment variables (supports .env.local for Next.js projects)
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
  } catch {
    // dotenv not available, rely on process.env already being populated
  }

  const shouldCleanup = process.env.SEED_CLEANUP === "true";
  const shouldSeed = process.env.SEED_DATA === "true" || (!shouldCleanup && process.argv.includes("--seed"));

  const supabase = getSupabaseAdmin();

  if (shouldCleanup) {
    await cleanupSeedData(supabase);
    return;
  }

  if (!shouldSeed && !process.argv.includes("--seed")) {
    // Default behavior when running the script directly (no flags)
    // is to seed. Only skip if SEED_DATA is explicitly "false"
    if (process.env.SEED_DATA === "false") {
      console.log("ℹ️  SEED_DATA=false — Skipping seed.");
      return;
    }
  }

  // Idempotency check
  const exists = await checkSeedExists(supabase);
  if (exists) {
    console.log("ℹ️  Seed data already exists. Skipping. Set SEED_CLEANUP=true to remove.");
    return;
  }

  await seedDatabase(supabase);
}

main().catch((err) => {
  console.error("Fatal error during seed:", err);
  process.exit(1);
});
