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
4. Input your Gemini API Key in settings (or configure a .env when that's set up)

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
- Chat history
- Readd animation
- Stream AI responses
- Purchase domain
- Fix occasional {"chunk":... \n"} bug when saying eg 'hi'
- Rename to DataFlow?
- Remove/improve settings menu and local API key?
- Fix bug when line is too long and spills past blue background

- Add support for viewing embedded data, charts etc.. 
- Merge 2 API Gemini paths in app.jsx and generate.js
- Voice mode?
