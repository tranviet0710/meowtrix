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
- **Match_Engine**: The subsystem that compares Overlord and Agent trait tags to suggest matches
- **Search_Protocol**: The Temporal-based escalating notification workflow
- **Heatmap_Engine**: The subsystem that generates probability zone overlays on the map
- **Leaderboard**: The gamification ranking component for Informants
- **Auth_Service**: The Supabase-based authentication subsystem
- **Storage_Service**: The Supabase Storage subsystem for photo uploads
- **Claim_Workflow**: The multi-step verification process for matching a found cat to a lost cat
- **Notification_Service**: The subsystem responsible for delivering alerts to Informants

## Requirements

### Requirement 1: Informant Authentication

**User Story:** As a visitor, I want to register and sign in to the platform, so that I can report lost or found cats and interact with the community.

#### Acceptance Criteria

1. THE Auth_Service SHALL provide email and password registration for new Informants, requiring a valid email format and a password of at least 8 characters
2. THE Auth_Service SHALL provide email and password sign-in for existing Informants
3. WHERE OAuth is enabled, THE Auth_Service SHALL allow sign-in via third-party providers (Google, GitHub)
4. WHEN an Informant signs in successfully, THE Tracker SHALL redirect the Informant to the HQ_Dashboard
5. IF an Informant provides invalid credentials, THEN THE Auth_Service SHALL display an error message indicating authentication failure without revealing whether the email or password was incorrect
6. THE Auth_Service SHALL maintain an authenticated session for up to 7 days of inactivity, after which the session expires and the Informant must sign in again
7. WHEN an unauthenticated visitor attempts to access a protected route, THE Tracker SHALL redirect the visitor to the sign-in page
8. IF an Informant attempts to register with an email that is already associated with an existing account, THEN THE Auth_Service SHALL reject the registration and display an error message indicating the email is already in use
9. WHEN an Informant signs out, THE Tracker SHALL invalidate the session and redirect the Informant to the sign-in page

### Requirement 2: Lost Overlord Reporting

**User Story:** As an Informant, I want to report my lost cat with details and a photo, so that the community can help locate my cat.

#### Acceptance Criteria

1. WHEN an Informant submits the Lost Overlord Report_Form, THE Tracker SHALL create an Overlord record with the cat name (1 to 50 characters), description (0 to 500 characters), and last-seen timestamp
2. THE Report_Form SHALL allow the Informant to select the last-seen location by placing a pin on the Map_View
3. THE Report_Form SHALL allow the Informant to upload between 1 and 5 photos of the lost cat, accepting only JPEG, PNG, or WebP formats with a maximum file size of 5 MB per image
4. WHEN a photo is uploaded, THE Storage_Service SHALL store the image in Supabase Storage and associate the URL with the Overlord record
5. WHEN the Overlord record is saved successfully, THE Tracker SHALL place a pin on the Map_View at the last-seen location
6. THE Report_Form SHALL validate that cat name (1 to 50 characters), at least one photo, and last-seen location are provided before allowing submission, and SHALL display an inline error message adjacent to each field that fails validation
7. WHEN the Overlord record is created, THE Search_Protocol SHALL be initiated for that Overlord
8. IF photo upload or record creation fails, THEN THE Tracker SHALL display an error message indicating the failure reason, retain all entered form data, and allow the Informant to retry submission

### Requirement 3: Spotted Agent Reporting

**User Story:** As an Informant, I want to report a cat I spotted, so that lost cat owners can be notified of potential sightings.

#### Acceptance Criteria

1. WHEN an Informant submits the Spotted Agent Report_Form, THE Tracker SHALL create an Agent record with the sighting timestamp and optional description limited to 500 characters
2. THE Report_Form SHALL require the Informant to select the sighting location by placing a pin on the Map_View before allowing submission
3. THE Report_Form SHALL require the Informant to upload at least one and at most 5 photos of the spotted cat, each no larger than 5MB, in JPEG, PNG, or WebP format
4. WHEN a photo is uploaded, THE Storage_Service SHALL store the image in Supabase Storage and associate the URL with the Agent record
5. WHEN the Agent record is saved successfully, THE Tracker SHALL place a pin on the Map_View at the sighting location
6. WHEN the Agent record is created and the Vision_Service has extracted trait tags from the uploaded photos, THE Match_Engine SHALL evaluate the Agent against existing Overlord records
7. THE Report_Form SHALL validate that at least one photo and a sighting location pin are provided before enabling submission
8. IF photo upload or Agent record creation fails, THEN THE Tracker SHALL display an error message indicating the failure reason and preserve the Informant's entered form data for retry

### Requirement 4: AI Vision Tagging

**User Story:** As an Informant, I want uploaded cat photos to be automatically analyzed for visual traits, so that the system can accurately match lost and found cats.

#### Acceptance Criteria

1. WHEN a photo is uploaded for an Overlord or Agent record, THE Vision_Service SHALL send the image to the Gemini API for trait extraction within 30 seconds of upload completion
2. WHEN the Gemini API returns a response, THE Vision_Service SHALL parse the response and store extracted trait tags associated with the corresponding Overlord or Agent record in the database, including: primary color, secondary color (if present), pattern type (solid, tabby, calico, bicolor, tortoiseshell, pointed, tuxedo), fur length (short, medium, long), breed estimate, and up to 5 distinguishing physical features (e.g., eye color, ear shape, tail type, facial markings, body size)
3. WHEN multiple photos are uploaded for a single Overlord or Agent record, THE Vision_Service SHALL process each photo independently and merge the extracted trait tags into a single consolidated set of traits for that record
4. IF the Gemini API fails to respond within 30 seconds or returns an error, THEN THE Vision_Service SHALL retry the request once, and if the retry also fails, log the error and mark the record for manual tagging
5. IF the Gemini API returns a response that is missing one or more of the required traits (primary color, pattern type, fur length), THEN THE Vision_Service SHALL store the available traits and mark the record as having incomplete tagging for manual review
6. WHEN trait extraction is complete for a record, THE Vision_Service SHALL mark the record as ready for matching by the Match_Engine

### Requirement 5: Interactive Map

**User Story:** As an Informant, I want to view all lost and found cat reports on an interactive map, so that I can understand sighting activity in my area.

#### Acceptance Criteria

1. THE Map_View SHALL render using Leaflet.js with OpenStreetMap tiles via dynamic import with SSR disabled
2. THE Map_View SHALL display pin markers for Overlord records and Agent records, visually differentiated by marker color (one color for Overlords, a distinct color for Agents) so that the two categories are distinguishable at a glance
3. WHEN an Informant clicks a pin on the Map_View, THE Tracker SHALL display a popup with the record details including photo thumbnail (maximum 80×80 pixels), name or description, and timestamp formatted to the Informant's locale
4. WHEN the Map_View is first loaded and the Informant grants browser geolocation permission, THE Map_View SHALL center on the Informant's coordinates at zoom level 13
5. WHILE the Map_View is active, THE Tracker SHALL apply a pulsing animation (1–2 second cycle) to pins representing Overlord records that have not been marked as resolved
6. THE Map_View SHALL support zooming between zoom levels 3 and 18 and panning across the worldwide tile coverage
7. IF the Informant denies browser geolocation permission or the Geolocation API is unavailable, THEN THE Map_View SHALL center on a default location at zoom level 5
8. IF no Overlord or Agent records exist in the database, THEN THE Map_View SHALL display an empty-state message indicating that no reports are available yet

### Requirement 6: Predictive Trajectory Heatmap

**User Story:** As an Informant, I want to see a probability zone on the map showing where a lost cat is likely to be now, so that I can focus my search efforts.

#### Acceptance Criteria

1. WHEN an Overlord has been missing for more than 30 minutes, THE Heatmap_Engine SHALL generate a High Probability Zone overlay on the Map_View
2. THE Heatmap_Engine SHALL calculate the probability zone radius using a base roaming rate of 250 meters per hour multiplied by the elapsed hours since the Overlord was last seen
3. THE Heatmap_Engine SHALL expand the probability zone radius as elapsed time increases, starting at a minimum radius of 200 meters at 30 minutes and capping at a maximum radius of 5 kilometers
4. THE Map_View SHALL render the probability zone as a circular heatmap gradient overlay centered on the last-seen location, with highest opacity at the center fading to zero opacity at the outer edge
5. WHEN a new Agent sighting is reported within an Overlord's probability zone, THE Heatmap_Engine SHALL re-center the probability zone on the most recent Agent sighting location
6. WHEN an Overlord is marked as resolved, THE Heatmap_Engine SHALL remove the corresponding probability zone overlay from the Map_View within 5 seconds

### Requirement 7: Escalating Search Protocol

**User Story:** As an Informant who reported a lost cat, I want the system to automatically escalate search efforts over time, so that my cat has the best chance of being found.

#### Acceptance Criteria

1. WHEN an Overlord is reported missing, THE Search_Protocol SHALL initiate a Temporal workflow identified by the Overlord record ID for that Overlord
2. WHEN 1 hour has elapsed since the Overlord was reported, THE Search_Protocol SHALL send notifications via the Notification_Service to all Informants within a 1 kilometer radius of the last-seen location, indicating the Overlord name, photo thumbnail, and last-seen location
3. WHEN 6 hours have elapsed since the Overlord was reported, THE Search_Protocol SHALL auto-generate a printable PDF missing poster containing the Overlord photo, name, traits, and last-seen location, and store the PDF in the Storage_Service associated with the Overlord record
4. WHEN 24 hours have elapsed since the Overlord was reported, THE Search_Protocol SHALL expand the notification radius to 5 kilometers and send escalation alerts via the Notification_Service to Informants in the expanded zone who were not previously notified at the 1-hour stage
5. WHEN an Overlord is marked as found, THE Search_Protocol SHALL terminate the Temporal workflow and cancel any pending escalation timers so that no further notifications are sent
6. IF the Search_Protocol process is interrupted by a system restart, THEN THE Search_Protocol SHALL resume the workflow from the last completed escalation stage without re-sending notifications that were already delivered
7. WHEN a PDF missing poster is generated, THE Search_Protocol SHALL make the poster accessible to the reporting Informant via a download link on the Overlord record detail view

### Requirement 8: Cat Matchmaking

**User Story:** As an Informant, I want the system to automatically suggest potential matches between lost and found cats based on visual traits, so that reunions happen faster.

#### Acceptance Criteria

1. WHEN a new Agent record is created with trait tags, THE Match_Engine SHALL compare the Agent trait tags against all unresolved Overlord trait tags and calculate a similarity score on a scale of 0 to 100 for each comparison
2. WHEN a new Overlord record is created with trait tags, THE Match_Engine SHALL compare the Overlord trait tags against all unresolved Agent trait tags and calculate a similarity score on a scale of 0 to 100 for each comparison
3. WHEN the Match_Engine identifies a trait similarity score of 60 or above, THE Match_Engine SHALL create a match suggestion record linking the Agent and Overlord, storing the similarity score, matched trait tags, and creation timestamp
4. WHEN a match suggestion is created, THE Notification_Service SHALL notify the Informant who reported the matching Overlord and the Informant who reported the matching Agent
5. THE Match_Engine SHALL rank match suggestions by similarity score in descending order and display a maximum of 10 suggestions per Overlord record
6. IF an Agent or Overlord record has no trait tags at the time of comparison, THEN THE Match_Engine SHALL skip that record and re-evaluate it when trait tags become available from the Vision_Service
7. THE Match_Engine SHALL display the similarity score as a percentage alongside each match suggestion so the Informant can assess match confidence

### Requirement 9: Multi-Step Claim Verification

**User Story:** As an Informant, I want to verify that a found cat is mine through a secure process, so that cats are returned to the correct owner.

#### Acceptance Criteria

1. WHEN an Informant initiates a claim on a match suggestion, THE Claim_Workflow SHALL present a verification form requiring the Informant to answer exactly 3 verification questions: the cat's name, one unique physical marking, and one behavioral trait
2. THE Claim_Workflow SHALL compare each verification answer against the corresponding field in the original Overlord record using case-insensitive substring matching
3. WHEN the claiming Informant provides correct answers for at least 2 out of 3 verification questions, THE Claim_Workflow SHALL mark the claim as verified and notify both the claiming Informant and the reporting Informant via the Notification_Service
4. IF the claiming Informant provides correct answers for fewer than 2 out of 3 verification questions, THEN THE Claim_Workflow SHALL reject the claim and notify the claiming Informant with a message indicating verification failure
5. IF an Informant has failed verification for the same Overlord record 3 times, THEN THE Claim_Workflow SHALL lock that Informant from making further claims on that Overlord for 24 hours
6. WHEN a claim is verified, THE Tracker SHALL mark both the Overlord and Agent records as resolved, cancel any pending match suggestions for those records, and terminate the associated Search_Protocol workflow
7. IF a verified claim resolves an Overlord record, THEN THE Claim_Workflow SHALL reject all other pending claims on that Overlord and notify the affected Informants that the Overlord has been claimed

### Requirement 10: Hooman Informant Leaderboard

**User Story:** As an Informant, I want to earn points and see my rank on a leaderboard, so that I am motivated to help find lost cats.

#### Acceptance Criteria

1. WHEN an Informant uploads a Spotted Agent photo that leads to a verified match, THE Tracker SHALL award 10 points to that Informant and persist the updated total in the database
2. THE Leaderboard SHALL display all Informants who have at least 1 point, ranked by their total points in descending order, with ties broken by earliest first match timestamp
3. THE Leaderboard SHALL display rank position, Informant display name, total points, and number of successful matches for each entry
4. THE Leaderboard SHALL render using a data-table style with monospace font for data rows
5. WHEN new points are awarded to an Informant, THE Leaderboard SHALL reflect the updated point total and rank within 5 seconds for any Informant currently viewing the Leaderboard
6. THE Leaderboard SHALL be accessible to all authenticated Informants via the sidebar navigation

### Requirement 11: HQ Dashboard

**User Story:** As an Informant, I want a central dashboard that shows key statistics and provides navigation, so that I can quickly assess the state of operations and access features.

#### Acceptance Criteria

1. THE HQ_Dashboard SHALL display stat cards showing total Overlords tracked, active searches in progress (Overlords not yet marked as found), and Informants online (Informants with an active session within the last 5 minutes), updating the displayed values at least every 30 seconds
2. THE HQ_Dashboard SHALL display the Map_View as the primary hero component occupying at least 60% of the visible viewport area on desktop viewports (768 pixels and above)
3. THE HQ_Dashboard SHALL provide sidebar navigation with links to all major sections (Map, Report Lost, Report Found, Matches, Leaderboard, Profile) and visually indicate the currently active section using the #FFCC00 accent color
4. THE HQ_Dashboard SHALL use the dark-mode color scheme with #0A0A0F background and #FFCC00 accent colors
5. WHILE an Informant is viewing the HQ_Dashboard, THE Tracker SHALL display toast notifications for new match alerts and escalation updates, showing each toast for 5 seconds before auto-dismissing, with a maximum of 3 toasts visible simultaneously
6. IF the HQ_Dashboard fails to load stat card data, THEN THE Tracker SHALL display a loading skeleton for each stat card during fetch and an error indicator with a retry option if the fetch fails within 10 seconds

### Requirement 12: Mobile Responsiveness

**User Story:** As an Informant using a mobile device, I want the application to be fully usable on small screens, so that I can report sightings and check the map on the go.

#### Acceptance Criteria

1. WHILE the viewport width is below 768 pixels, THE Tracker SHALL collapse the sidebar navigation into a bottom navigation bar containing all navigation items defined in the HQ_Dashboard sidebar
2. WHILE the viewport width is below 768 pixels, THE Map_View SHALL occupy the full viewport width and a minimum height of 50% of the viewport height
3. WHILE the viewport width is below 768 pixels, THE Tracker SHALL render all interactive elements (buttons, links, form inputs, map controls) with a minimum tap target size of 44 by 44 CSS pixels
4. THE Tracker SHALL maintain all functionality across viewport sizes from 320 pixels to 2560 pixels wide without horizontal overflow that requires sideways scrolling
5. WHILE the viewport width is below 768 pixels, THE Tracker SHALL stack form fields in a single-column layout that occupies at least 90% of the viewport width

### Requirement 13: Data Security and Access Control

**User Story:** As an Informant, I want my data to be secure and only accessible to authorized users, so that cat location data and personal information remain protected.

#### Acceptance Criteria

1. THE Tracker SHALL enforce Row Level Security policies on all Supabase database tables such that no table permits unrestricted public access
2. THE Tracker SHALL ensure that Informants can only edit or delete Overlord and Agent records where the record's owner identifier matches the authenticated Informant's user identifier
3. IF an authenticated Informant attempts to edit or delete an Overlord or Agent record owned by a different Informant, THEN THE Tracker SHALL deny the operation and return a 403 status code
4. THE Tracker SHALL allow all authenticated Informants to read Overlord and Agent record data including cat name, description, photos, trait tags, location, and timestamps for matchmaking purposes
5. THE Tracker SHALL not expose Informant personal information (email address, authentication identifiers) through read access to Overlord or Agent records to other Informants
6. THE Tracker SHALL store all API keys and secrets in environment variables, include the environment variable files in .gitignore, and exclude them from the code repository
7. THE Tracker SHALL pass Aikido SAST and Dependency Scanning checks with no critical or high-severity findings at the time of each merge to the main branch
8. IF an unauthenticated request is made to a protected API endpoint, THEN THE Tracker SHALL return a 401 status code and deny access
9. IF an authenticated request is made to a resource the Informant is not permitted to modify, THEN THE Tracker SHALL return a 403 status code and deny access
