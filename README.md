# CivicFlowTO
## Create by Azaria Kelman @ PROGRAM: Toronto Hackathon

### Demo version that uses some hard-coded data. Full MCP version coming soon.

## Key features
- AI-powered chat interface for querying Toronto's open data and city services using MCP
- Suggested questions to demonstrate how to use it
- Markdown formatting support for text responses
- Help menu, add Gemini API key in settings, dark/light theme

## Installation and configuration instructions 
1. Clone the repository: `git clone https://github.com/azariak/CivicFlow.git`
2. Install dependencies: `npm install`
3. Run the project: `npm run dev`
4. Configure `.dev.vars` basefd on `.dev.vars.example`

## Code Layout
  - `App.jsx` - Core application with most stuff (including Gemini calls when using API key in settings)
  - Components:
    - `InputArea.jsx` - 
    - `MessageList.jsx` - 
    - `SettingsModal.jsx` - Local API key configuration
    - `SuggestedQuestions.jsx` - Pre-defined question suggestions
    - `HelpPopup.jsx` - Help documentation modal
    - `helpContent.jsx` - Help content and documentation
  - `data/questionsAndAnswers.json` - Pre-defined Q&A and system instructions
- `functions/` 
  - `api/generate.js` - Serverless function for Gemini calls through Cloudflare (when no API key in settings)
- `public/` - Static assets (logos, icons, SVGs)

## TODO:
Prelaunch:
- Readd animation
- Purchase domain
- Rename to DataFlow?
- Remove/improve settings menu and local API key?
- Fix bug when line is too long and spills past blue background
- Deal with rate limits (and render the error correctly)
- MD rendering within AI details?
- Scroll when AI details is clicked
- Adjust systemPrompt for click here for links
- Add support for viewing embedded data, charts etc.. 
- Merge 2 API Gemini paths in app.jsx and generate.js
- Voice mode?
- Smoothen streaming
- Non-text parts of functionResponse
- Add more details button that allows you to get actual data
