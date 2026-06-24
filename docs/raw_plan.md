- I am currently join the #hackthekitty hackathon (https://hackthekitty.com), this hackathon main topic is about cat. Candidates have to develop web, app, tool, whatever.... regarding cats, but the project should be very realistic.

### 🐾 Context & Purpose

- **The Context:** The event is billed as "The World Cat Domination Day Hackathon." Hosted by the [coding.kitty](https://thecodingkitty.com/) community, it’s a fully virtual, 14-day event bringing together developers who share a love for "cats and code."
    
    - **The Purpose:** The primary goal is to build something real that fits the (likely feline-inspired) theme, meet cool people, get your work showcased to thousands of developers, and compete for a $5,500+ prize pool.
    

### 📋 Key Requirements

- **Timeline:** The 14-day building period runs strictly from **June 24 to July 7, 2026**.
    
- **Team Size:** You can work solo or with a maximum of **one partner** (teams are strictly capped at 2 members). Registration requires a Discord account.
    
- **Technology Stack:** Completely open. You can build a web app, game, CLI tool, or even a macro-heavy spreadsheet using whatever tech you prefer.
    
- **Fresh Code Only:** All code must be written _during_ the hackathon. You can brainstorm beforehand, but pre-written code is not allowed.
    
- **Deliverables:** To officially submit, you must provide a **ZIP file of your project**, a **short video demo**, and a **link to your GitHub repository**.

### 🏆 How to Be a Strong Candidate

To maximize your chances of winning part of the $5,500+ prize pool, your strategy should align directly with the judging criteria and the event's sponsors.

**1. Optimize for the 6 Judging Categories** Scoring is anonymous and broken down into six specific areas. To be a strong candidate, your project shouldn't just work; it needs to be well-rounded:

- **Technical & Innovation:** Build something unique.
    
- **Theme Relevance:** Make sure your project clearly ties into the "World Cat Domination Day" theme.
    
- **UX/UI:** Ensure your project looks good and is easy for the judges to navigate.
    
- **Documentation:** Write a stellar `README.md` on your GitHub. Explain what the project is, how to install/run it, and the tech stack used.
    
- **Security:** Don't ignore basic security practices (like hiding API keys).
    

**2. Use AI as an Assistant, Not a Crutch** While AI tools like Kiro are permitted, the FAQ explicitly warns that _“copy-pasting an entire app from an AI prompt isn't going to score well on innovation.”_ Use AI to troubleshoot or speed up boilerplate code, but ensure the core logic and creativity are your own.

**3. Cater to the Judges' Expertise** The judging panel features industry professionals from **AWS, Aikido Security, Temporal, and Deloitte**. Because these judges specialize in engineering, security, and cloud infrastructure:

- Make sure your deployment and infrastructure are solid.
    
- Since Aikido Security is a sponsor, incorporating good security practices (or even using their tools) could earn you major points in the "Security" judging category.
    
- Since Temporal is a sponsor, if your app requires background jobs or complex workflows, utilizing their tech might help your project stand out.
    

**4. Nail the Video Demo** Your video demo is often the first impression judges get of your project. Keep it concise, show the value proposition immediately, highlight how it fits the cat theme, and demonstrate the core features working flawlessly.

### 🧠 Stand-Out Feature Suggestions

To win a hackathon, you need a "wow" factor. Here is how you can level up your core idea:

**1. "Feline Overlord Tracker" (The Thematic Spin)** Instead of a sad "Lost Pet" vibe, lean into the hackathon's "World Cat Domination" theme for your pitch and UI. Frame the app as a tool to track the movements of our "feline overlords."

- **Lost Post:** "Overlord went off-grid."
    
- **Found Post:** "Agent spotted."
    
- This playful UX will make your demo highly memorable for the judges.
    

**2. Predictive Trajectory Mapping (The Tech Flex)** Don't just show a pin where the cat was lost. Use a mapping API (like Google Maps or Mapbox) combined with some basic logic to generate a **"High Probability Zone" heatmap**.

- If a cat was lost 12 hours ago, draw a radius based on average feline roaming distances.
    
- _Bonus points:_ Have the algorithm avoid busy highways on the map and highlight residential alleys or parks as likely hiding spots.
    

**3. "Purr-veillance" Automated Alerts (Sponsor Integration)** Since **Temporal** (a workflow engine) is a sponsor, this is a perfect opportunity to use their tech.

- Set up a background workflow: Whenever a new "Found" cat is uploaded, the system automatically scans all "Lost" cats within a 10-mile radius.
    
- If the AI detects an 85%+ visual match, it automatically triggers an SMS or email alert to the owner.
    

**4. One-Click "Missing Poster" Generator** When a user submits a lost cat, have the app automatically generate a beautifully formatted, printable PDF poster using the uploaded data (Photo, Name, QR code linking back to the app). It’s a relatively simple feature to code, but it looks incredibly polished in a demo.

**5. Granular AI Vision Tags** Instead of just a black-box "Match: Yes/No," have your AI extract and display specific tags from the uploaded photos.

- _Example output:_ "Confidence: 92% — Matching traits: Orange Tabby, White Paws, Left Ear Notch." This proves to the judges that your AI isn't just a gimmick; it's actively analyzing coat patterns and features.

**6. Secure "Claim Your Overlord" Protocol (Aikido Security Flex)**

- **The Feature:** When someone finds a cat, you don't want just anyone claiming it. Build a secure, multi-step verification process to ensure the right human is matched with the right cat.
    
- **Why it wins:** You can use this to score major points in the "Security" category. Mention in your demo/README that you used Aikido's tools to secure the data, prevent SQL injection on the user inputs, or scan your dependencies. Showing you thought about _data privacy_ (blurring locations for public users, but showing exact coordinates to verified owners) is a massive green flag for senior engineering judges.
    

**7. The "Escalating Search" Protocol (Temporal Workflow Flex)**

- **The Feature:** Instead of just sending one notification, build a time-based escalation workflow.
    
    - _Hour 1:_ Notify all app users within a 1-mile radius.
        
    - _Hour 6:_ Automatically generate the missing poster PDF and email it to the owner to print.
        
    - _Hour 24:_ Expand the radius to 5 miles and automatically email local (mocked) animal shelters.
        
- **Why it wins:** This is the _exact_ use case **Temporal** is built for (managing complex, long-running, time-based background jobs). The judges from Temporal will absolutely love seeing their tech used this way.
    

**8. "IoT Collar" Mock Data Ingestion (AWS Flex)**

- **The Feature:** Create a mock "smart collar" feature. Simulate a data stream (perhaps using AWS IoT Core or simply AWS Lambda) that occasionally "pings" a cat's location if it walks past a known public Wi-Fi network.
    
- **Why it wins:** It adds a layer of realism and hardware integration (even if simulated). You can show a live map in your demo where a cat's icon "jumps" to a new location in real-time as a ping comes in.
    

**9. Gamified "Hooman Informant" Leaderboard**

- **The Feature:** Reward users for being active participants in the feline network. If a user uploads a photo of a "spotted" cat that leads to a successful match, they get points.
    
- **Why it wins:** This crushes the UI/UX category. A dark-mode, sleek dashboard showing the "Top Informants of the Week" makes the app feel like a lively, engaging community rather than just a static database.
    

**10. Night Vision / Low-Light Image Enhancement**

- **The Feature:** Cats are nocturnal, meaning a lot of photos taken of "spotted" cats will be in the dark. Add a quick image-processing filter (you can use simple CSS or a lightweight library) that allows users to toggle "Enhance" to brighten up dark, grainy photos of cats hiding in bushes.
    
- **Why it wins:** It’s a very specific, empathetic feature that solves a real-world problem for finding lost pets, and it looks highly interactive during a video demo.

### Tech Stack
This is a fantastic strategy. You’ve already done the hardest part of any hackathon: scoping a project that perfectly intersects the theme, the judges' expertise, and a genuine "wow" factor.

Since you are building a full-stack, AI-integrated app with background workflows and map features, the primary risk is getting bogged down in infrastructure. You need a stack that is **100% free**, deploys instantly, and natively supports the sponsor technologies you want to flex.

Here is the ultimate zero-budget tech stack optimized for a 14-day sprint.

#### 1. The Core Application Stack (100% Free)

This stack minimizes boilerplate so you can focus on building the "Feline Overlord Tracker" logic.

- **Frontend & API Gateway:** **Next.js (React)** deployed on **Vercel**.
    
    - _Why:_ It’s the fastest way to spin up a UI and backend API routes in a single repository. Vercel’s free "Hobby" tier gives you unlimited deployments, meaning you can push code and test live instantly.
        
- **Database, Auth & Storage:** **Supabase**.
    
    - _Why:_ Supabase is an open-source Firebase alternative built on PostgreSQL. Their free tier gives you a database, user authentication (for your "Claim Your Overlord" protocol), and object storage (for uploading cat photos) right out of the box.
        
- **Mapping & Heatmaps:** **Leaflet.js** with **OpenStreetMap**.
    
    - _Why:_ Unlike Google Maps, which requires setting up a billing account and API keys, Leaflet is a completely free, open-source mapping library. You can easily draw your "High Probability Zone" radius overlays on top of it.
        
- **AI Vision & Tagging:** **Google Gemini API** or **OpenAI API**.
    
    - _Why:_ Gemini has a highly generous free tier for developers. If you opt for OpenAI, simply load $5 onto the account—for the volume of requests in a hackathon, you will likely spend less than $0.50 analyzing cat photos.
        

#### 2. The Sponsor Flex Stack (How to Score Points for Free)

You correctly identified that catering to the judges is how you win. Here is how to implement the sponsor tools using their actual 2026 free tiers.

- **Aikido Security (The Security Flex)**
    
    - **The Free Tier:** Aikido’s "Developer" plan is **$0 / free forever** for up to 2 users—which perfectly matches the hackathon's strict 2-person team limit.
        
    - **How to use it:** Connect Aikido to your GitHub repository on Day 1. It will run Dependency Scanning (SCA) and SAST to ensure you have no vulnerabilities. Take screenshots of your clean Aikido dashboard and put them front-and-center in your `README.md` to guarantee points in the "Security" judging category.
        
- **Temporal (The Workflow Flex)**
    
    - **The Free Tier:** Temporal Cloud currently offers a **90-day universal free trial with $1,000 in credits** for new accounts.
        
    - **How to use it:** Use Temporal to build your "Escalating Search Protocol." Since Temporal specializes in durable, long-running processes, you can write a workflow that waits exactly 6 hours, checks if the cat is still missing, and automatically generates the missing poster PDF.
        
- **AWS (The Infrastructure Flex)**
    
    - **The Free Tier:** **AWS Lambda** provides 1 million free requests per month, permanently.
        
    - **How to use it:** Build a simple Lambda function to act as your "IoT Collar" mock data generator. You can have it randomly ping your Supabase database with GPS coordinates every 5 minutes. _Bonus:_ Temporal recently released support for Serverless Workers on AWS Lambda, allowing you to tie AWS and Temporal together beautifully.
        

#### 3. The 14-Day Execution Plan

In a 14-day hackathon, scoping is everything. Cut ruthlessly if a feature takes longer than its allotted time.

Days 1-3: Infrastructure & Foundation

June 24-26

Initialize Next.js repo, connect it to Vercel, and set up Supabase (Auth, DB schema, Storage). Connect Aikido Security to your GitHub to start scanning immediately.

Days 4-6: Core Feline Tracking

June 27-29

Build the UI to report a "Lost Overlord" or a "Spotted Agent." Implement the Leaflet map to drop pins and draw the High Probability Zone radius.

Days 7-9: AI Vision & Matchmaking

June 30 - July 2

Integrate the AI API. When a photo is uploaded, extract tags (e.g., "Orange Tabby, Left Ear Notch") and save them to Supabase to enable intelligent searching.

Days 10-11: The Temporal Flex

July 3-4

Implement your background job. Set up a Temporal workflow to trigger the "Escalating Search Protocol" (sending automated alerts 1 hour and 6 hours after a cat goes missing).

Days 12-13: UI Polish & Bug Squashing

July 5-6

Add the dark-mode "Hooman Informant" leaderboard. Clean up the UI, hide API keys, and ensure the app looks incredible on mobile.

Day 14: The Deliverables

July 7

Stop coding. Write your stellar `README.md` highlighting Aikido and Temporal. Record, edit, and submit your short video demo showing off the Feline Overlord tracker in action.