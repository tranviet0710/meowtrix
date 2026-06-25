# Requirements Document

## Introduction

MEOWTRIX is a "Feline Overlord Tracker" — a spy-agency themed web dashboard for tracking and recovering lost cats. Built for the #hackthekitty hackathon, the system enables users ("Informants") to report lost cats ("Lost Overlords"), report found cats ("Spotted Agents"), leverage AI-powered image analysis for matchmaking, and coordinate recovery via escalating notification workflows. The application features an interactive map with predictive trajectory heatmaps, gamified community engagement, and a polished dark-mode command-center aesthetic.

## Glossary

- **Tracker**: The MEOWTRIX web application system
- **Informant**: A registered user of the platform
- **Overlord**: A lost cat record submitted by an Informant
- **Agent**: A found/spotted cat record submitted by an Informant
- **HQ_Dashboard**: The main dashboard view with navigation, statistics, and map
- **Map_View**: The interactive Leaflet.js map component displaying pins and overlays
- **Report_Form**: The form component for submitting lost or found cat reports
- **Vision_Service**: The AI image analysis service powered by Gemini API
- **Match_Engine**: The subsystem that compares Overlord and Agent records using visual traits, descriptions, location proximity, and other fields to suggest matches
- **Search_Protocol**: The Temporal-based escalating notification workflow
- **Heatmap_Engine**: The subsystem that generates probability zone overlays on the map
- **Leaderboard**: The gamification ranking component for Informants
- **Auth_Service**: The Supabase-based authentication subsystem
- **Storage_Service**: The Supabase Storage subsystem for photo uploads
- **Claim_Workflow**: The multi-step verification process where a claimant proves ownership of a found cat through security questions, with the original reporter confirming resolution
- **Notification_Service**: The subsystem responsible for delivering alerts to Informants
- **Residential_Area**: The neighborhood or approximate location provided by an Informant during registration, used for proximity-based notifications
- **Image_Optimizer**: The subsystem responsible for compressing and converting uploaded images to optimize storage while preserving visual quality
- **Seed_Service**: The subsystem responsible for populating the database with realistic default data for demonstration purposes

## Requirements

### Requirement 1: Informant Authentication

**User Story:** As a visitor, I want to register and sign in to the platform, so that I can report lost or found cats and interact with the community.

#### Acceptance Criteria

1. THE Auth_Service SHALL provide email and password registration for new Informants, requiring a valid email format and a password between 8 and 128 characters in length
2. WHEN an Informant registers, THE Auth_Service SHALL require the Informant to provide a Residential_Area (neighborhood name or approximate address) between 1 and 200 characters, which the Tracker stores for proximity-based notification calculations
3. THE Auth_Service SHALL provide email and password sign-in for existing Informants
4. WHERE OAuth is enabled, THE Auth_Service SHALL allow sign-in via third-party providers (Google, GitHub)
5. WHEN an Informant signs in successfully, THE Tracker SHALL redirect the Informant to the HQ_Dashboard
6. IF an Informant provides invalid credentials, THEN THE Auth_Service SHALL display an error message indicating authentication failure without revealing whether the email or password was incorrect; however, the Auth_Service MAY display distinct error messages for non-credential issues such as account lockouts, disabled accounts, or server errors even when the email and password are valid
7. THE Auth_Service SHALL maintain an authenticated session for up to 7 days of inactivity, after which the session expires and the Informant must sign in again
8. WHEN an unauthenticated visitor attempts to access a protected route, THE Tracker SHALL redirect the visitor to the sign-in page and, upon successful sign-in, redirect the Informant back to the originally requested route
9. IF an Informant attempts to register with an email that is already associated with an existing account, THEN THE Auth_Service SHALL reject the registration and display an error message indicating the email is already in use
10. WHEN an Informant signs out, THE Tracker SHALL invalidate the session and redirect the Informant to the sign-in page
11. THE Auth_Service SHALL geocode the Informant's Residential_Area into latitude and longitude coordinates and store the coordinates in the Informant profile for use by the Notification_Service
12. IF the geocoding service fails to resolve the Informant's Residential_Area into coordinates, THEN THE Auth_Service SHALL complete the registration, display an error message indicating that the location could not be resolved, and allow the Informant to update their Residential_Area from their profile

### Requirement 2: Lost Overlord Reporting

**User Story:** As an Informant, I want to report my lost cat with details and a photo, so that the community can help locate my cat.

#### Acceptance Criteria

1. WHEN an Informant submits the Lost Overlord Report_Form, THE Tracker SHALL create an Overlord record with the cat name (1 to 50 characters), description (0 to 500 characters), and last-seen timestamp that must not be in the future and must not be more than 30 days before the submission date
2. THE Report_Form SHALL allow the Informant to select the last-seen location by placing a pin on the Map_View
3. THE Report_Form SHALL allow the Informant to upload between 1 and 5 photos of the lost cat, accepting only JPEG, PNG, or WebP formats with a maximum file size of 5 MB per image
4. WHEN a photo is uploaded, THE Storage_Service SHALL store the image in Supabase Storage and associate the URL with the Overlord record within 15 seconds of upload completion
5. WHEN the Overlord record is saved successfully, THE Tracker SHALL place a pin on the Map_View at the last-seen location
6. THE Report_Form SHALL validate that cat name (1 to 50 characters), at least one photo, last-seen location, and a last-seen timestamp within the allowed range are provided before allowing submission, and SHALL display an inline error message adjacent to each field that fails validation
7. WHEN the Overlord record is created, THE Search_Protocol SHALL be initiated for that Overlord
8. IF photo upload or record creation fails, THEN THE Tracker SHALL display an error message indicating the failure reason, retain all entered form data, and allow the Informant to retry submission; WHEN submission succeeds, THE Report_Form SHALL clear all form data and navigate to the newly created Overlord record
9. THE Report_Form SHALL require the Informant to provide verification details for future claims: the cat's name, one unique physical marking (1 to 200 characters), and one behavioral trait (1 to 200 characters), storing these fields in the Overlord record such that they are not exposed to any Informant other than the record owner through read access or API responses

### Requirement 3: Spotted Agent Reporting

**User Story:** As an Informant, I want to report a cat I spotted, so that lost cat owners can be notified of potential sightings.

#### Acceptance Criteria

1. WHEN an Informant submits the Spotted Agent Report_Form, THE Tracker SHALL create an Agent record with a system-generated sighting timestamp (set to the moment of submission) and an optional description of 0 to 500 characters
2. THE Report_Form SHALL require the Informant to select the sighting location by placing a pin on the Map_View before allowing submission
3. THE Report_Form SHALL require the Informant to upload at least one and at most 5 photos of the spotted cat, each no larger than 5MB, in JPEG, PNG, or WebP format
4. WHEN a photo is uploaded, THE Storage_Service SHALL store the image in Supabase Storage and associate the URL with the Agent record
5. WHEN the Agent record is saved successfully, THE Tracker SHALL place a pin on the Map_View at the sighting location; IF pin placement fails after successful record creation, THEN THE Tracker SHALL roll back the record creation and display an error message allowing the Informant to retry
6. WHEN the Agent record is created and the Vision_Service has extracted trait tags from the uploaded photos, THE Match_Engine SHALL evaluate the Agent against existing Overlord records
7. THE Report_Form SHALL validate that at least one photo and a sighting location pin are provided before enabling submission, and SHALL display an inline error message adjacent to each field that fails validation; THE Report_Form SHALL NOT create an Agent record if validation fails
8. IF photo upload or Agent record creation fails, THEN THE Tracker SHALL display an error message indicating the failure reason and preserve the Informant's entered form data for retry

### Requirement 4: AI Vision Tagging

**User Story:** As an Informant, I want uploaded cat photos to be automatically analyzed for visual traits, so that the system can accurately match lost and found cats.

#### Acceptance Criteria

1. WHEN a photo is uploaded for an Overlord or Agent record, THE Vision_Service SHALL send the image to the Gemini API for trait extraction within 30 seconds of upload completion
2. WHEN the Gemini API returns a response, THE Vision_Service SHALL parse the response and store extracted trait tags associated with the corresponding Overlord or Agent record in the database, including: primary color, secondary color (if present), pattern type (solid, tabby, calico, bicolor, tortoiseshell, pointed, tuxedo), fur length (short, medium, long), breed estimate (or "unknown" if the breed cannot be determined), and up to 5 distinguishing physical features (e.g., eye color, ear shape, tail type, facial markings, body size)
3. WHEN multiple photos are uploaded for a single Overlord or Agent record, THE Vision_Service SHALL process each photo independently and merge the extracted trait tags into a single consolidated set by selecting the most frequently occurring value for each single-value trait (primary color, pattern type, fur length, breed estimate) and combining all unique distinguishing physical features, then selecting the 5 most frequently mentioned features if the combined total exceeds 5
4. IF the Gemini API fails to respond within 30 seconds or returns an error, THEN THE Vision_Service SHALL retry the request once, and if the retry also fails, log the error and mark the record for manual tagging
5. IF the Gemini API returns a response that is missing one or more of the required traits (primary color, pattern type, fur length), THEN THE Vision_Service SHALL store the available traits and mark the record as having incomplete tagging for manual review
6. WHEN all photos associated with a record have been processed by the Vision_Service (either successfully tagged, marked incomplete, or marked for manual tagging after retry failure), THE Vision_Service SHALL mark the record as ready for matching by the Match_Engine
7. IF two or more trait values for a single-value field occur with equal frequency across multiple photos, THEN THE Vision_Service SHALL select the value extracted from the most recently uploaded photo as the authoritative value

### Requirement 5: Interactive Map

**User Story:** As an Informant, I want to view all lost and found cat reports on an interactive map, so that I can understand sighting activity in my area.

#### Acceptance Criteria

1. THE Map_View SHALL render using Leaflet.js with OpenStreetMap tiles via dynamic import with SSR disabled
2. THE Map_View SHALL display pin markers for Overlord records and Agent records, visually differentiated by marker color (one color for Overlords, a distinct color for Agents) so that the two categories are distinguishable at a glance
3. WHEN an Informant clicks a pin on the Map_View, THE Tracker SHALL display a popup with the record details including photo thumbnail (maximum 80×80 pixels), name or description, and timestamp formatted to the Informant's locale
4. WHEN the Map_View is first loaded and the Informant grants browser geolocation permission within 10 seconds, THE Map_View SHALL center on the Informant's coordinates at zoom level 13
5. WHILE the Map_View is active, THE Tracker SHALL apply a pulsing animation (1–2 second cycle) to pins representing Overlord records that have not been marked as resolved
6. THE Map_View SHALL support zooming between zoom levels 3 and 18 and panning across the worldwide tile coverage
7. IF the Informant denies browser geolocation permission or the Geolocation API does not respond within 10 seconds, THEN THE Map_View SHALL center on the Informant's stored Residential_Area coordinates at zoom level 13, or if Residential_Area coordinates are unavailable, center on geographic coordinates 13.7563, 100.5018 (Bangkok, Thailand) at zoom level 5
8. IF no Overlord or Agent records exist in the database, THEN THE Map_View SHALL display an empty-state message indicating that no reports are available yet
9. WHILE the Map_View is fetching Overlord and Agent records from the database, THE Map_View SHALL display a loading skeleton overlay on the map area, and IF the fetch does not complete within 10 seconds, THEN THE Map_View SHALL display an error indicator with a retry option

### Requirement 6: Predictive Trajectory Heatmap

**User Story:** As an Informant, I want to see a probability zone on the map showing where a lost cat is likely to be now, so that I can focus my search efforts.

#### Acceptance Criteria

1. WHEN more than 30 minutes have elapsed since an Overlord's last-seen timestamp, THE Heatmap_Engine SHALL generate a High Probability Zone overlay on the Map_View for that Overlord
2. THE Heatmap_Engine SHALL calculate the probability zone radius using the formula: radius = max(200, min(5000, 250 × elapsed hours since last-seen timestamp)), where the radius is expressed in meters, the minimum radius is 200 meters, and the maximum radius is 5 kilometers
3. THE Heatmap_Engine SHALL recalculate and update the probability zone radius at least every 5 minutes while the Overlord remains unresolved, reflecting the increased elapsed time
4. THE Map_View SHALL render the probability zone as a circular heatmap gradient overlay centered on the last-seen location, with a maximum opacity of 0.6 at the center fading linearly to zero opacity at the outer edge
5. WHEN a new Agent sighting is reported within the current probability zone radius of an Overlord, THE Heatmap_Engine SHALL re-center the probability zone on the most recent Agent sighting location and continue calculating elapsed time from the original Overlord last-seen timestamp
6. WHEN an Overlord is marked as resolved, THE Heatmap_Engine SHALL remove the corresponding probability zone overlay from the Map_View within 5 seconds; IF removal exceeds 5 seconds due to system load, THE Heatmap_Engine SHALL retry removal up to 3 times with exponential backoff before logging the failure
7. IF no Agent sightings exist within an Overlord's probability zone, THEN THE Heatmap_Engine SHALL keep the probability zone centered on the Overlord's original last-seen location

### Requirement 7: Escalating Search Protocol

**User Story:** As an Informant who reported a lost cat, I want the system to automatically escalate search efforts over time, so that my cat has the best chance of being found.

#### Acceptance Criteria

1. WHEN an Overlord is reported missing, THE Search_Protocol SHALL initiate a Temporal workflow identified by the Overlord record ID for that Overlord
2. WHEN 6 hours have elapsed since the Overlord was reported, THE Search_Protocol SHALL send in-app notifications via the Notification_Service to all Informants whose registered Residential_Area coordinates are within a 1 kilometer radius of the Overlord's last-seen location, including the Overlord name, a photo thumbnail no larger than 200×200 pixels, and last-seen location coordinates
3. WHEN 24 hours have elapsed since the Overlord was reported, THE Search_Protocol SHALL auto-generate a printable PDF missing poster in A4 page format containing the Overlord photo, name, trait tags, and last-seen location, and store the PDF in the Storage_Service associated with the Overlord record
4. WHEN 48 hours have elapsed since the Overlord was reported, THE Search_Protocol SHALL expand the notification radius to 5 kilometers and send in-app escalation alerts via the Notification_Service to Informants whose registered Residential_Area coordinates are within the expanded zone and who were not previously notified at the 6-hour stage
5. WHEN an Overlord is marked as found by the original reporting Informant, THE Search_Protocol SHALL terminate the Temporal workflow and cancel any pending escalation timers so that no further notifications are sent
6. IF the Search_Protocol process is interrupted by a system restart, THEN THE Search_Protocol SHALL resume the workflow from the last completed escalation stage (6-hour, 24-hour, or 48-hour) without re-sending notifications that were already delivered
7. WHEN a PDF missing poster is generated, THE Search_Protocol SHALL make the poster accessible to the reporting Informant via a download link on the Overlord record detail view within 10 seconds of generation completing
8. THE Notification_Service SHALL determine notification recipients by calculating the geodesic distance between the Overlord's last-seen location and each Informant's registered Residential_Area coordinates
9. IF the Search_Protocol workflow has been active for 14 days without the Overlord being marked as found, THEN THE Search_Protocol SHALL terminate the workflow automatically and send a final in-app notification to the reporting Informant indicating the automated search period has concluded
10. IF no Informants are located within the notification radius at the 6-hour or 48-hour escalation stage, THEN THE Search_Protocol SHALL log the skipped notification attempt and proceed to the next scheduled escalation stage without error

### Requirement 8: Cat Matchmaking

**User Story:** As an Informant, I want the system to automatically suggest potential matches between lost and found cats based on visual traits, descriptions, location, and other details, so that reunions happen faster.

#### Acceptance Criteria

1. WHEN a new Agent record is created with trait tags, THE Match_Engine SHALL compare the Agent against all unresolved Overlord records and calculate a weighted similarity score on a scale of 0 to 100 for each comparison, combining visual trait similarity (40% weight), text description similarity (25% weight), geographical proximity between the Agent sighting location and the Overlord last-seen location (25% weight), and other matching fields such as breed estimate and fur length (10% weight)
2. WHEN a new Overlord record is created with trait tags, THE Match_Engine SHALL compare the Overlord against all unresolved Agent records and calculate a weighted similarity score on a scale of 0 to 100 for each comparison using the same weighting formula
3. WHEN the Match_Engine identifies a weighted similarity score of 60 or above, THE Match_Engine SHALL create a match suggestion record linking the Agent and Overlord, storing the overall similarity score, individual component scores, matched trait tags, and creation timestamp
4. WHEN a match suggestion is created with a similarity score of 60 or above, THE Notification_Service SHALL notify the Informant who reported the matching Overlord and the Informant who reported the matching Agent, including the match similarity score, the cat photo thumbnail, and a link to the match suggestion detail view
5. THE Match_Engine SHALL rank match suggestions by overall similarity score in descending order and display a maximum of 10 suggestions per Overlord record
6. IF an Agent or Overlord record has no trait tags at the time of comparison, THEN THE Match_Engine SHALL skip that record and re-evaluate it when trait tags become available from the Vision_Service
7. THE Match_Engine SHALL display the overall similarity score as a percentage alongside each match suggestion, with a breakdown showing the visual, description, proximity, and other component scores so the Informant can assess match confidence
8. THE Match_Engine SHALL calculate geographical proximity score using an inverse distance function where Agent sightings within 500 meters of the Overlord last-seen location receive the maximum proximity score, decreasing linearly to zero at 10 kilometers distance
9. WHEN a new Agent or Overlord record triggers match processing, THE Match_Engine SHALL complete the comparison against all candidate records and persist any resulting match suggestions within 60 seconds of the trigger event
10. IF the Match_Engine identifies a match between an Agent and Overlord pair for which a match suggestion record already exists, THEN THE Match_Engine SHALL skip creating a duplicate suggestion and retain the existing record unchanged
11. IF the Match_Engine fails to complete comparison within 60 seconds due to a processing error or timeout, THEN THE Match_Engine SHALL log the failure and mark the triggering record for re-evaluation on the next scheduled retry cycle

### Requirement 9: Multi-Step Claim Verification

**User Story:** As an Informant who lost my cat, I want to claim a found cat through a secure verification process, so that I can prove ownership and be reunited with my cat.

#### Acceptance Criteria

1. WHEN an Informant who reported an Overlord initiates a claim on a match suggestion linking their Overlord to an Agent, THE Claim_Workflow SHALL present a verification form requiring the claimant to answer exactly 3 verification questions unique to the Overlord: the cat's name, one unique physical marking, and one behavioral trait, with each answer field accepting between 1 and 200 characters
2. THE Claim_Workflow SHALL compare each verification answer against the corresponding verification details stored in the original Overlord record using case-insensitive substring matching, where the claimant's answer is considered correct if the stored value contains the claimant's answer as a substring (minimum 3 characters required for a substring match to prevent trivially short answers from passing)
3. WHEN the claimant provides correct answers for at least 2 out of 3 verification questions and this is the only verified claim for that Agent, THE Claim_Workflow SHALL mark the claim as verified and notify the Informant who reported the Agent (the finder) via the Notification_Service, providing the claimant's contact notification channel and the Agent sighting location so the parties can arrange pickup directly
4. IF the claimant provides correct answers for fewer than 2 out of 3 verification questions, THEN THE Claim_Workflow SHALL reject the claim and notify the claimant with a message indicating verification failure without revealing which specific answers were incorrect
5. IF an Informant has failed verification for the same Overlord record 3 times, THEN THE Claim_Workflow SHALL lock that Informant from making further claims on that Overlord for 24 hours, and SHALL reset the failed attempt counter to zero after the 24-hour lockout period expires
6. IF multiple verified claims exist for the same Agent record, THEN THE Claim_Workflow SHALL notify all verified claimants and the Informant who reported the Agent to arrange a meeting at the Agent sighting location, providing each party's contact notification channel so they can coordinate a retrieval time
7. WHEN the original reporting Informant (the Overlord owner) manually marks the Overlord as "found" after retrieving the cat, THE Tracker SHALL update the Overlord status to resolved, cancel any pending match suggestions for that Overlord, and terminate the associated Search_Protocol workflow
8. THE Claim_Workflow SHALL restrict the resolution action exclusively to the original Informant who reported the Overlord; no other Informant or administrator may mark the Overlord as resolved
9. WHEN an Overlord is marked as resolved, THE Claim_Workflow SHALL reject all other pending claims on that Overlord and notify the affected claimants that the Overlord has been reunited with the owner
10. WHEN an Overlord is marked as resolved and the resolution is associated with a verified claim on a specific Agent record, THE Tracker SHALL also mark that Agent record as resolved and cancel any other pending match suggestions for that Agent

### Requirement 10: Hooman Informant Leaderboard

**User Story:** As an Informant, I want to earn points and see my rank on a leaderboard, so that I am motivated to help find lost cats.

#### Acceptance Criteria

1. WHEN the Claim_Workflow marks a claim as verified for an Agent record, THE Tracker SHALL award 10 points to the Informant who originally reported that Agent and persist the updated total in the database
2. THE Leaderboard SHALL display all Informants who have at least 1 point, ranked by their total points in descending order, with ties broken by earliest first match timestamp, showing a maximum of 50 entries per page with pagination controls to access additional entries
3. THE Leaderboard SHALL display rank position, Informant display name, total points, and number of successful matches for each entry, and SHALL visually highlight the currently authenticated Informant's own row if present on the visible page
4. THE Leaderboard SHALL render using a data-table style with monospace font for data rows
5. WHEN new points are awarded to an Informant, THE Leaderboard SHALL reflect the updated point total and rank within 5 seconds for any Informant currently viewing the Leaderboard
6. THE Leaderboard SHALL be accessible to all authenticated Informants via the sidebar navigation
7. THE Leaderboard SHALL provide a social sharing button that allows any Informant to share the full ranking page to external social media platforms (Facebook, Twitter/X, LINE) via platform-specific share URLs
8. WHEN an Informant clicks the social sharing button, THE Tracker SHALL generate a shareable link to the public Leaderboard page with an Open Graph preview card containing the leaderboard title, top 3 ranked Informants, and the MEOWTRIX branding
9. IF no Informants have earned any points, THEN THE Leaderboard SHALL display an empty-state message indicating that no rankings are available yet and encouraging Informants to report spotted cats

### Requirement 11: HQ Dashboard

**User Story:** As an Informant, I want a central dashboard that shows key statistics and provides navigation, so that I can quickly assess the state of operations and access features.

#### Acceptance Criteria

1. THE HQ_Dashboard SHALL display stat cards showing total Overlords tracked, active searches in progress (Overlords not yet marked as found), and Informants online (Informants with an active session within the last 5 minutes), updating the displayed values at least every 30 seconds
2. THE HQ_Dashboard SHALL display the Map_View as the primary hero component occupying at least 60% of the visible viewport area on desktop viewports (768 pixels and above)
3. THE HQ_Dashboard SHALL provide sidebar navigation with links to all major sections (Map, Report Lost, Report Found, Matches, Leaderboard, Profile) and visually indicate the currently active section using the #FFCC00 accent color
4. THE HQ_Dashboard SHALL use the dark-mode color scheme with #0A0A0F background and #FFCC00 accent colors
5. WHILE an Informant is viewing the HQ_Dashboard, THE Tracker SHALL display toast notifications for new match alerts and escalation updates, showing each toast for 5 seconds before auto-dismissing, with a maximum of 3 toasts visible simultaneously, and SHALL queue any additional notifications that arrive while 3 toasts are visible, displaying each queued notification as a visible slot becomes available
6. WHEN the HQ_Dashboard initiates a stat card data fetch, THE Tracker SHALL display a loading skeleton for each stat card until data is received or the request times out
7. IF the stat card data fetch fails or does not respond within 10 seconds, THEN THE Tracker SHALL replace the loading skeleton with an error indicator and a retry button, and WHEN the Informant activates the retry button, THE Tracker SHALL re-initiate the fetch and display the loading skeleton until the retry resolves

### Requirement 12: Mobile Responsiveness

**User Story:** As an Informant using a mobile device, I want the application to be fully usable on small screens, so that I can report sightings and check the map on the go.

#### Acceptance Criteria

1. WHILE the viewport width is below 768 pixels, THE Tracker SHALL collapse the sidebar navigation into a fixed bottom navigation bar that remains visible during scroll, containing all navigation items defined in the HQ_Dashboard sidebar
2. WHILE the viewport width is below 768 pixels, THE Map_View SHALL occupy the full viewport width and a minimum height of 50% of the viewport height
3. WHILE the viewport width is below 768 pixels, THE Tracker SHALL render all interactive elements (buttons, links, form inputs, map controls) with a minimum tap target size of 44 by 44 CSS pixels
4. THE Tracker SHALL maintain all functionality across viewport sizes from 320 pixels to 2560 pixels wide without horizontal overflow that requires sideways scrolling
5. WHILE the viewport width is below 768 pixels, THE Tracker SHALL stack form fields in a single-column layout that occupies at least 90% of the viewport width
6. WHILE the viewport width is below 768 pixels, THE Tracker SHALL render body text at a minimum font size of 16 CSS pixels to ensure readability without zooming
7. WHILE the viewport width is below 768 pixels, THE Tracker SHALL position toast notifications above the bottom navigation bar so that notifications and navigation elements do not overlap

### Requirement 13: Data Security and Access Control

**User Story:** As an Informant, I want my data to be secure and only accessible to authorized users, so that cat location data and personal information remain protected.

#### Acceptance Criteria

1. THE Tracker SHALL enforce Row Level Security policies on all Supabase database tables such that no table permits unrestricted public access
2. THE Tracker SHALL ensure that Informants can only edit or delete Overlord and Agent records where the record's owner identifier matches the authenticated Informant's user identifier
3. IF an authenticated Informant attempts to edit or delete an Overlord or Agent record owned by a different Informant, THEN THE Tracker SHALL deny the operation and return a 403 status code
4. THE Tracker SHALL allow all authenticated Informants to read Overlord and Agent record data including cat name, description, photos, trait tags, location, and timestamps for matchmaking purposes
5. THE Tracker SHALL not expose Informant personal information (email address, authentication identifiers, and Residential_Area coordinates) through read access to Overlord or Agent records or through any public API response to other Informants
6. THE Tracker SHALL store all API keys and secrets in environment variables, include the environment variable files in .gitignore, and exclude them from the code repository
7. WHEN a merge to the main branch is initiated, THE Tracker SHALL pass Aikido SAST and Dependency Scanning checks with no critical or high-severity findings before the merge is completed
8. IF an unauthenticated request is made to any API endpoint other than authentication routes (sign-in, registration, OAuth callback), THEN THE Tracker SHALL return a 401 status code and deny access
9. IF an authenticated request is made to a resource the Informant is not permitted to modify, THEN THE Tracker SHALL return a 403 status code and deny access
10. THE Tracker SHALL configure Supabase Storage bucket policies so that uploaded photos are readable by all authenticated Informants but only deletable by the Informant who uploaded them

### Requirement 14: Image Optimization

**User Story:** As an Informant, I want my uploaded images to be automatically optimized, so that the system uses storage efficiently while keeping photos clear enough for identification.

#### Acceptance Criteria

1. WHEN a photo is uploaded for an Overlord or Agent record, THE Image_Optimizer SHALL compress or convert the image to reduce file size and store the result in the Storage_Service within 10 seconds of upload completion
2. IF the uploaded image format is JPEG or PNG, THEN THE Image_Optimizer SHALL convert the image to WebP format using a quality setting that achieves at least 40% file size reduction compared to the original
3. IF the uploaded image format is already WebP, THEN THE Image_Optimizer SHALL re-compress the image using a quality setting that achieves at least 20% file size reduction compared to the original; IF the 20% reduction cannot be achieved without violating the SSIM threshold, THEN THE Image_Optimizer SHALL store the original image unchanged
4. THE Image_Optimizer SHALL preserve the original image aspect ratio, downscale images with a longest edge exceeding 2048 pixels to 2048 pixels on the longest edge, and maintain a minimum resolution of 800 pixels on the longest edge
5. IF the uploaded image has a resolution at or below 800 pixels on its longest edge, THEN THE Image_Optimizer SHALL apply format conversion and compression without any downscaling, storing the image at its original resolution
6. THE Image_Optimizer SHALL produce output images that pass a structural similarity index (SSIM) threshold of 0.85 compared to the original
7. WHEN the Image_Optimizer processes an image successfully, THE Storage_Service SHALL store only the optimized version and discard the original to conserve storage space
8. IF the Image_Optimizer encounters an error during compression or conversion, or fails to complete processing within 10 seconds, THEN THE Storage_Service SHALL store the original unmodified image and log the optimization failure for review

### Requirement 15: Seed Data for Demonstration

**User Story:** As a developer or demo presenter, I want the system to start with realistic mock data, so that the application looks populated and functional during demonstrations.

#### Acceptance Criteria

1. THE Seed_Service SHALL populate the database with at least 15 Overlord records and 10 Agent records containing realistic cat names, descriptions, last-seen locations within a geographically coherent area, and representative photos
2. THE Seed_Service SHALL create at least 5 Informant accounts with realistic display names and Residential_Area values that correspond to the seeded Overlord and Agent locations
3. THE Seed_Service SHALL generate trait tags for each seeded Overlord and Agent record that are consistent with the associated photos and descriptions
4. THE Seed_Service SHALL create at least 3 match suggestion records between seeded Overlord and Agent records with varying similarity scores (one above 80, one between 60 and 80, and one below 60) to demonstrate the matchmaking interface
5. THE Seed_Service SHALL seed at least 3 Overlord records with varying statuses: at least one active (unresolved with ongoing Search_Protocol), at least one resolved, and at least one with a pending verified claim, to demonstrate multiple workflow states
6. THE Seed_Service SHALL seed at least 2 Informant leaderboard entries with points and successful match counts to demonstrate the Leaderboard functionality
7. THE Seed_Service SHALL mark all seeded data records with a "seed" flag in the database so that seeded records are identifiable and distinguishable from production data
8. THE Tracker SHALL provide a command-line script or environment variable flag that, when executed or enabled, removes all records marked with the "seed" flag from the database and deletes associated files from Supabase Storage without affecting non-seeded production data
9. THE Seed_Service SHALL execute automatically on first database initialization when the SEED_DATA environment variable is set to "true", and SHALL skip seeding when the variable is absent or set to "false"
10. IF the Seed_Service detects that seeded records already exist in the database (idempotency check), THEN THE Seed_Service SHALL skip seeding and log a message indicating that seed data is already present

### Requirement 16: AI Post Creation (Future Feature — Out of Scope)

**User Story:** As an Informant, I want the system to automatically create reports by capturing images of lost cat posts from social media, so that more lost cats are registered without manual effort.

> **Note:** This requirement documents a planned future feature. It is explicitly out of scope for the current implementation phase and is recorded here for future reference and planning purposes only.

#### Acceptance Criteria

1. WHERE the AI Post Creation feature is enabled in a future release, THE Tracker SHALL accept image uploads of social media posts containing lost cat information and extract structured data (cat name, description, location, contact information) using the Vision_Service
2. WHERE the AI Post Creation feature is enabled in a future release, THE Tracker SHALL compare the extracted data against existing Overlord records and warn the Informant if a duplicate entry is detected with a similarity score above 80, preventing redundant posts
3. WHERE the AI Post Creation feature is enabled in a future release, THE Tracker SHALL display a confirmation screen showing the extracted data before creating the Overlord record, allowing the Informant to review and correct any misidentified fields
