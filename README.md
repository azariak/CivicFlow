# DataFlowTO
## Created by Azaria Kelman @ PROGRAM: Toronto Hackathon

## Key features
- AI-powered chat interface for querying Toronto's open data and city services using MCP
- Suggested questions to demonstrate how to use it
- Markdown formatting, streaming support for text responses
- Help menu, dark/light theme, resize/reset container, settings API key (deprecated)

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
- Purchase domain
- Remove/improve settings menu and local API key?
- Fix bug when line is too long and spills past blue background (happens when MD misrenders)
- Deal with rate limits (and render the error correctly)
- MD rendering within AI details?
- Shows fewer results then on opendata website (total found vs returned_count?)
- Rename to DataFlow

- Add support for viewing embedded data, charts etc.. 
- Voice mode?
- Smoothen streaming
- Non-text parts of functionResponse error in console
- Add more details follow up button that allows you to get actual data
- https://open.toronto.ca/toronto-open-data-awards-2025/
- Dead links provided via MCP see: ice rinks https://www.toronto.ca/data/parks/prd/facilities/outdoor-rinks/index.html\
