# Requirements Document

## Introduction

This feature adds an AI-assisted pathway for creating both Lost Pet Reports and Spotted Pet Reports (found reports). Users who see a missing-pet post on Facebook or Instagram can screenshot the post and upload (or paste) it into Meowtrix. An AI vision service reads the screenshot, extracts pet information and location details, detects the pet's photo, and pre-fills the corresponding report form. The user reviews, edits, and submits normally through the existing endpoints.

Scope:

- Adds an "AI assist" panel to `report-lost` and `report-found` pages.
- Input: one image (JPEG, PNG, or WebP) up to 5 MB, provided via file picker, drag-and-drop, or clipboard paste (Ctrl+V / Cmd+V).
- Output: AI-suggested values pre-fill the existing form fields; user reviews then submits via the existing `POST /api/overlords` (lost) or `POST /api/agents` (spotted) endpoints. No new report tables or submission endpoints are created.
- Language support: Vietnamese and English screenshots. Vietnamese addresses, phone numbers, and pet descriptions must be recognized.

Non-goals (explicit scope guard):

- No changes to the existing Lost Report or Spotted Report forms, their fields, their Zod validators, or their submission endpoints.
- No new report types, database tables, or submission endpoints.
- No sidebar, navigation, or dashboard changes.

Working assumptions (confirmed with product owner):

- A1. AI never fills ownership-verification fields — the user must always enter those manually.
- A2. Address text extracted by the AI is forward-geocoded via the existing Nominatim wrapper. If geocoding fails, the user drops the pin manually.
- A3. The AI attempts to detect pet regions in the screenshot and offers cropped candidates plus the full screenshot; the user picks which to attach.
- A4. Per-user rate limit: 5 successful AI extractions per authenticated user per rolling 24 hours.
- A5. A privacy notice must be acknowledged before extraction, because screenshots may contain third-party personal data.
- A6. If AI cannot read the screenshot, the user falls back to the manual form (no new report type).
- A7. Because the person who posted the original social-media post is not necessarily the pet owner, extracted contact phone and contact name are treated as reference information and auto-appended to the description (not written to any owner contact field).
- A8. The AI assist UI is a modal opened by a single "Create with AI" button on each report page. The manual form remains the primary UI and is not visually disturbed when the modal is closed.

## Glossary

- **AI_Extractor**: Server-side component that sends a screenshot to the Gemini vision model and returns a structured `ExtractionResult`.
- **Screenshot**: An image uploaded by the user capturing a social-media post about a missing or spotted pet.
- **ExtractionResult**: A structured object containing candidate values for report fields (pet_name, pet_type, description, last_seen_address_text, last_seen_at, contact_phone, contact_name) plus a list of detected pet-photo crops. Each field carries a confidence label of `high`, `medium`, or `low`.
- **AI_Assist_Modal**: The modal dialog opened by the "Create with AI" button on the Lost Report page and on the Spotted Report page. It accepts a Screenshot and drives the extraction flow. The modal closes once the user confirms the AI suggestions, at which point the pre-filled values are written into the Report_Form.
- **Report_Form**: The existing Lost Overlord form (`LostOverlordForm`) or Spotted Agent form (`SpottedAgentForm`). AI pre-fills these forms; users still submit through the existing endpoints.
- **Geocoder**: The existing Nominatim wrapper (`lib/geocoding.ts`) used to convert address text into coordinates (forward geocoding).
- **Rate_Limiter**: A per-user quota that caps AI extraction requests to reduce cost and abuse.
- **Privacy_Notice**: An in-panel disclaimer shown before submission that reminds the user their screenshot may contain third-party personal data.
- **Confidence_Label**: A field-level tag with value `high`, `medium`, or `low` describing how sure the AI is about that field.

## Requirements

### Requirement 1: Entry Point on Both Report Pages

**User Story:** As a helper who just saw a Facebook post about a missing pet, I want a single clearly labeled "Create with AI" button on both the Lost Report page and the Spotted Report page, so that I can start the AI-assisted flow without any change to the existing form.

#### Acceptance Criteria

1. THE Lost Report page SHALL display a "Create with AI" button positioned above the existing manual Report_Form.
2. THE Spotted Report page SHALL display a "Create with AI" button positioned above the existing manual Report_Form.
3. WHEN the user activates the "Create with AI" button, THE AI_Assist_Modal SHALL open on top of the current page.
4. WHEN the user closes the AI_Assist_Modal without confirming any AI suggestions, THE Report_Form SHALL retain the exact values it held before the modal was opened.
5. THE existing manual Report_Form (fields, labels, layout, validators, and submit control) SHALL remain unchanged whether the AI_Assist_Modal has been opened or not.
6. THE Report_Form SHALL accept manual entry into every field regardless of whether the AI_Assist_Modal is open or closed.

### Requirement 2: Multi-Method Screenshot Input

**User Story:** As a user on desktop or mobile, I want to provide the screenshot in whichever way is fastest — clicking to select, dragging in, or pasting from the clipboard — so that the flow feels natural on any device.

#### Acceptance Criteria

1. THE AI_Assist_Modal SHALL accept a Screenshot via a file picker button.
2. THE AI_Assist_Modal SHALL accept a Screenshot via drag-and-drop onto a designated drop target.
3. WHEN the AI_Assist_Modal is open and the user presses Ctrl+V or Cmd+V with an image on the clipboard, THE AI_Assist_Modal SHALL treat the pasted image as the uploaded Screenshot.
4. IF the uploaded file is not a JPEG, PNG, or WebP image, THEN THE AI_Assist_Modal SHALL reject the file and display the message "Only JPEG, PNG, or WebP images are supported".
5. IF the uploaded file exceeds 5 megabytes, THEN THE AI_Assist_Modal SHALL reject the file and display the message "Screenshot must be 5MB or smaller".

### Requirement 3: Privacy Notice Before Extraction

**User Story:** As a user about to upload a screenshot that may contain other people's phone numbers or names, I want to be told this before I send anything, so that I can make an informed choice.

#### Acceptance Criteria

1. WHEN the AI_Assist_Modal opens, THE AI_Assist_Modal SHALL display a Privacy_Notice explaining that screenshots may contain third-party personal data and are processed by an external AI service.
2. THE AI_Assist_Modal SHALL require the user to acknowledge the Privacy_Notice via a checkbox before an AI extraction request is sent.
3. WHILE the Privacy_Notice checkbox is unchecked, THE AI_Assist_Modal SHALL keep the "Analyze screenshot" control disabled.

### Requirement 4: AI Field Extraction from Screenshot

**User Story:** As a user who uploaded a Facebook post screenshot, I want the AI to read the post and pre-fill as many form fields as it can, so that I spend less time retyping.

#### Acceptance Criteria

1. WHEN the user triggers extraction on an accepted Screenshot, THE AI_Extractor SHALL send the Screenshot to the Gemini vision model with a structured prompt requesting the fields listed in Requirement 4.2.
2. THE AI_Extractor SHALL attempt to extract these fields from the Screenshot: pet_name, pet_type, description, last_seen_address_text, last_seen_at, contact_phone, contact_name.
3. THE AI_Extractor SHALL assign a Confidence_Label of `high`, `medium`, or `low` to every returned field.
4. WHERE the AI_Extractor cannot identify a value for a field, THE AI_Extractor SHALL return `null` for that field.
5. THE AI_Extractor SHALL recognize Vietnamese and English text in the Screenshot.
6. IF the Gemini vision call times out after 30 seconds or otherwise fails, THEN THE AI_Extractor SHALL retry the request one time.
7. WHEN a retried extraction attempt succeeds, THE AI_Extractor SHALL return the successful ExtractionResult to the caller.
8. IF both the initial extraction attempt and the retry fail, THEN THE AI_Extractor SHALL return an `extraction_error` result to the caller.
9. WHEN extraction returns an `extraction_error`, THE AI_Assist_Modal SHALL display the message "We couldn't read this screenshot. You can still fill the form manually" and leave the manual Report_Form untouched.

### Requirement 5: Address to Coordinates Conversion

**User Story:** As a user, I want the extracted address to appear as a pin on the map automatically when possible, so that I don't have to also locate it manually.

#### Acceptance Criteria

1. WHEN the AI_Extractor returns a non-null last_seen_address_text of 1 to 500 characters, THE Geocoder SHALL forward-geocode that text into a latitude in the range -90.0 to 90.0 and a longitude in the range -180.0 to 180.0, completing the request within 5 seconds.
2. WHEN forward geocoding returns one or more results, THE AI_Assist_Modal SHALL write the coordinates of the highest-relevance result into the Report_Form's map picker state so the map is centered on that pin after the modal closes.
3. IF forward geocoding returns zero results, THEN THE AI_Assist_Modal SHALL leave the Report_Form's map picker without a pin and display the message "We couldn't map this address. Drop the pin yourself" inside the modal before closing.
4. IF forward geocoding fails due to a network error, a service error, or exceeding the 5-second timeout, THEN THE AI_Assist_Modal SHALL leave the Report_Form's map picker without a pin, preserve the raw extracted address text, and display a message indicating that automatic mapping is unavailable and prompting the user to drop the pin manually.
5. WHEN the AI_Extractor returns a non-null last_seen_address_text, THE AI_Assist_Modal SHALL display that raw extracted address text so the user can verify what the AI read before confirming the suggestions.

### Requirement 6: Pet Photo Detection and Cropping

**User Story:** As a user, I want the AI to pick out the pet's image from the screenshot so that I don't have to crop it myself, but I also want to override the choice if needed.

#### Acceptance Criteria

1. WHEN extraction runs, THE AI_Extractor SHALL identify up to 5 candidate pet regions in the Screenshot and return each region as a cropped image.
2. THE AI_Assist_Modal SHALL display all candidate crops together with the full Screenshot as selectable thumbnails.
3. THE AI_Assist_Modal SHALL require the user to select at least 1 image and at most 5 images before the "Apply to form" control becomes enabled.
4. IF the AI_Extractor detects zero pet regions, THEN THE AI_Assist_Modal SHALL display the full Screenshot as the only selectable candidate.
5. WHEN the user confirms the photo selection, THE AI_Assist_Modal SHALL upload each selected image through the existing `POST /api/upload` endpoint and write the returned URLs into the Report_Form's photo state.

### Requirement 7: Pre-Fill Preview and Confirmation

**User Story:** As a user reviewing the AI's work inside the modal, I want to see the suggested values with a confidence indicator before they land in my form, so that I can catch mistakes before they overwrite anything.

#### Acceptance Criteria

1. WHEN extraction completes successfully, THE AI_Assist_Modal SHALL display every non-null extracted field value in a preview list, labeled by field name.
2. WHERE an extracted field has a Confidence_Label of `low`, THE AI_Assist_Modal SHALL mark that field's preview row with a "Please double-check this" caption.
3. THE AI_Assist_Modal SHALL provide a single "Apply to form" control that is enabled only when at least one preview field has a non-null value and the photo selection rule from Requirement 6 is satisfied.
4. WHEN the user activates "Apply to form", THE AI_Assist_Modal SHALL write every non-null extracted field into its corresponding Report_Form field, replacing any prior value, and close the modal.
5. WHEN "Apply to form" is activated, THE AI_Assist_Modal SHALL leave every Report_Form field for which the AI returned `null` at the value it had before the modal was opened.

### Requirement 8: Verification Fields Are Never Auto-Filled

**User Story:** As a pet owner, I don't want strangers' Facebook posts to accidentally fill in my personal ownership-verification answers, so that verification remains something only the true owner provides.

#### Acceptance Criteria

1. THE AI_Extractor SHALL never return values for verification_name, verification_marking, or verification_trait.
2. IF the underlying vision model produces text that appears to match any verification field, THEN THE AI_Extractor SHALL discard that text before returning the ExtractionResult while still returning every other extracted field.
3. WHEN the AI_Assist_Modal applies AI suggestions to the Lost Report_Form, THE AI_Assist_Modal SHALL leave the ownership verification fields (verification_name, verification_marking, verification_trait) untouched.
4. THE Lost Report_Form SHALL continue to require the user to fill verification_name, verification_marking, and verification_trait manually through the same validation rules used for manual submissions.

### Requirement 9: Contact Data Appended to Description

**User Story:** As a helper posting on behalf of the original poster, I want the phone number and name from the post to end up in the description automatically, so that anyone reading the report can still contact the original poster (who may or may not be the pet owner).

#### Acceptance Criteria

1. WHEN the AI_Extractor returns a non-null contact_phone, THE AI_Assist_Modal SHALL append a line "Contact from original post: <contact_phone>" to the description field before writing the description to the Report_Form.
2. WHEN the AI_Extractor returns a non-null contact_name, THE AI_Assist_Modal SHALL include the contact name on the same appended contact line as contact_phone when both are present, or as its own line "Contact from original post: <contact_name>" when only the name is present.
3. THE AI_Assist_Modal SHALL never write contact_phone or contact_name into any owner or reporter identity field on the Report_Form.
4. IF both contact_phone and contact_name are null, THEN THE AI_Assist_Modal SHALL leave the description exactly as the AI_Extractor returned it, with no contact line appended.
5. THE AI_Assist_Modal SHALL display the appended description text in the preview described in Requirement 7 so the user can review the final description before it is written to the form.

### Requirement 10: Fallback and Submission Through Existing Endpoints

**User Story:** As a user, I want to submit the report through the existing form flow after AI pre-fill, so that nothing about validation or backend behavior changes.

#### Acceptance Criteria

1. THE Report_Form SHALL run the same Zod validation on submission whether fields were filled by the user or by the AI.
2. WHEN the user submits an AI-pre-filled Lost report, THE Report_Form SHALL send the payload to `POST /api/overlords` in the same shape used for manual submissions.
3. WHEN the user submits an AI-pre-filled Spotted report, THE Report_Form SHALL send the payload to `POST /api/agents` in the same shape used for manual submissions.
4. WHERE any required field remains empty after AI pre-fill, THE Report_Form SHALL display the same inline validation error a manual submission would produce.

### Requirement 11: Rate Limiting and Cost Control

**User Story:** As the platform operator, I want to cap how often each user can call the AI extractor, so that a single user cannot exhaust our Gemini quota.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL allow at most 5 successful AI extraction requests per authenticated user per rolling 24-hour window.
2. IF an authenticated user exceeds the extraction quota, THEN THE AI_Extractor SHALL respond with HTTP 429 and the message "You've reached today's AI limit. Please try again tomorrow or fill the form manually".
3. IF the AI_Extractor receives a request from an unauthenticated caller, THEN THE AI_Extractor SHALL respond with HTTP 401.
4. IF the AI_Extractor receives a request body larger than 5 megabytes, THEN THE AI_Extractor SHALL respond with HTTP 413.

### Requirement 12: Loading and Error States

**User Story:** As a user who just uploaded a screenshot, I want clear feedback while the AI is working, so that I know the system is not frozen.

#### Acceptance Criteria

1. WHILE an AI extraction request is in flight, THE AI_Assist_Modal SHALL display a loading indicator with the caption "Reading your screenshot".
2. WHILE an AI extraction request is in flight, THE AI_Assist_Modal SHALL keep the "Analyze screenshot" control disabled.
3. WHILE an AI extraction request is in flight, THE AI_Assist_Modal SHALL keep the "Apply to form" control disabled.
4. IF the extraction request fails due to a network error, THEN THE AI_Assist_Modal SHALL display the message "Network error. Try again in a moment" and re-enable the "Analyze screenshot" control.

### Requirement 13: Themes and Accessibility

**User Story:** As a user on either theme, I want the AI modal to match the rest of the app, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE AI_Assist_Modal SHALL use the app's design tokens (for example `bg-card`, `text-primary`, `border-border`) so that it renders correctly in both the dark and the light theme.
2. THE AI_Assist_Modal SHALL provide a visible focus ring on every interactive control.
3. THE AI_Assist_Modal SHALL expose alt text and ARIA labels for the drop zone, each candidate crop thumbnail, and the loading indicator.
4. WHEN the AI_Assist_Modal opens, THE AI_Assist_Modal SHALL move keyboard focus into the modal and trap focus within it until the modal is closed.
5. WHEN extraction completes successfully, THE AI_Assist_Modal SHALL announce the result via an ARIA live region so screen-reader users are informed.
