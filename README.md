# Kiro Activity Insights

<div align="center">
  <img src="icon.png" alt="Kiro Activity Insights" width="128" height="128">
</div>

A private, local activity profile panel for Kiro IDE that visualizes your development activity, language usage, and AI model interactions—all processed locally without sending data to external servers.

![Version](https://img.shields.io/badge/version-0.1.11-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 📊 Activity Heatmap
- **GitHub-style contribution graph** showing your daily activity
- Tracks git commits and Kiro session usage
- Multi-year view with year selector
- Visual intensity levels based on token usage and commits

### 📈 Development Metrics
Track comprehensive statistics about your Kiro usage:
- **Kiro launches** in the last 30 days
- **Local session count** and largest session size
- **Estimated token usage** with peak day tracking
- **Credits recorded** from your AI interactions
- **Average turn length** for conversation analysis
- **Current and longest streaks** to monitor consistency

### 💻 Language Insights
- Top 5 programming languages in your workspace
- File counts per language
- Automatic detection from file extensions (TypeScript, JavaScript, Python, Java, Go, Rust, C++, and more)

### 🤖 AI Model Analytics
- Most-used AI models ranked by turn count
- Model usage statistics from session history
- Tracks all model interactions automatically

### 🎨 Profile Customization
Configure your profile display through VS Code settings:
- **Display Name**: Your full name shown on the profile card
- **Username**: Handle displayed below your name
- **Plan Label**: Badge shown next to username (e.g., "Local", "Pro")

### 📸 Share Card Generator
- Export your profile as a shareable PNG image
- Saved to `kiro-profile-shares/` in your workspace
- Perfect for showcasing your development activity

### 🔒 Privacy-First Design
- **100% local processing** - no external API calls
- Data sourced from local git history and Kiro session files
- No telemetry or tracking
- Your activity data never leaves your machine

## Installation

### From VSIX File

1. Download the latest `.vsix` file from releases or build from source
2. Install in Kiro IDE:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run "Extensions: Install from VSIX..."
   - Select the downloaded `.vsix` file
3. Open **Kiro Profile** from the activity bar (sidebar icon)

### Build from Source

```powershell
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

This generates a `.vsix` file you can install in Kiro.

## Usage

### Opening the Profile Panel

**Method 1**: Click the **Kiro Profile** icon in the activity bar (left sidebar)

**Method 2**: Use Command Palette
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Run "Kiro Profile: Open Activity Insights"

### Refreshing Data

Click the refresh button in the panel header or run "Kiro Profile: Refresh Activity Insights" from the Command Palette.

### Customizing Your Profile

1. Open Settings (File > Preferences > Settings)
2. Search for "Kiro Activity Insights"
3. Configure:
   - `kiroActivityInsights.displayName` - Your display name
   - `kiroActivityInsights.username` - Your username/handle
   - `kiroActivityInsights.planLabel` - Badge label (e.g., "Local", "Pro")

### Sharing Your Profile

1. Click the **Share** button in the profile panel
2. Image is saved to `kiro-profile-shares/` in your workspace
3. Share the PNG on social media or with your team

## How It Works

### Data Sources

The extension collects activity data from multiple local sources:

**Git History**
- Parses git log for the last 365 days
- Extracts commit dates to build activity timeline
- Uses `git log --date=short --pretty=format:%ad --all --since="365 days ago"`

**Kiro Session Files**
- Reads session JSON files from `~/.kiro/sessions/`
- Extracts token counts, credits, model usage, and timestamps
- Estimates metrics from session file sizes when exact data unavailable

**Kiro Application Logs**
- Scans log directories in `%APPDATA%/Kiro/logs/` (Windows)
- Counts Kiro launches in the last 30 days
- No log content is parsed—only directory names (timestamps)

**Workspace Files**
- Walks current workspace directory tree
- Counts files by programming language
- Respects common ignore patterns (node_modules, .git, dist, etc.)

**Kiro Configuration**
- Counts installed hooks from `~/.kiro/hooks/`
- Counts installed powers from `~/.kiro/powers/`
- Counts extensions from `~/.kiro/extensions/`

### Activity Heatmap Algorithm

1. **Token Estimation**: Session files without explicit token counts use `fileSize / 4`
2. **Git Contribution Bonus**: Each git commit day receives +1,500 estimated tokens
3. **Intensity Levels**: Days are colored by token count ranges:
   - Level 0: 0 tokens (dark gray)
   - Level 1: 1-2,000 tokens (light blue)
   - Level 2: 2,001-5,000 tokens (medium blue)
   - Level 3: 5,001-8,000 tokens (bright blue)
   - Level 4: 8,000+ tokens (orange)

### Streak Calculation

- **Current Streak**: Consecutive days with activity ending today
- **Longest Streak**: Maximum consecutive active days in history
- Minimum streak displayed is 3 days for new users

## Development

### Project Structure

```
kiro-activity-insights/
├── src/
│   └── extension.ts       # Main extension logic
├── resources/
│   └── activity.svg        # Activity bar icon
├── out/                    # Compiled JavaScript output
├── package.json            # Extension manifest
└── tsconfig.json           # TypeScript configuration
```

### Key Components

**ProfileViewProvider**
- Implements `WebviewViewProvider` interface
- Manages webview lifecycle and message handling
- Handles refresh and share card operations

**collectProfileData()**
- Main data aggregation function
- Combines git, session, workspace, and config data
- Returns structured `ProfileData` object

**getKiroUsage()**
- Parses Kiro session files and logs
- Extracts token usage, model counts, credits
- Calculates session metrics and statistics

**getWorkspaceFileStats()**
- Walks workspace directory tree (max depth 8)
- Counts files by programming language
- Skips common ignore directories

### Available Scripts

```json
{
  "compile": "tsc -p ./",           // Compile TypeScript to JavaScript
  "watch": "tsc -watch -p ./",       // Compile with watch mode
  "check": "tsc --noEmit -p ./",     // Type-check without output
  "package": "vsce package --allow-missing-repository"  // Create .vsix
}
```

### Contributing

Contributions are welcome! Areas for improvement:

- **Additional metrics**: Support for more Kiro-specific features
- **UI enhancements**: More visualizations and interactive elements
- **Performance**: Optimize large workspace and session file parsing
- **Export formats**: JSON, CSV, or PDF report generation
- **Themes**: Light mode support and color customization

## Requirements

- Kiro IDE (VS Code compatible version ^1.92.0)
- Node.js and npm (for building from source)
- Git (optional, for commit activity tracking)

## Known Limitations

- **Workspace-dependent language stats**: Language insights require an open workspace
- **Session file format dependency**: Relies on current Kiro session JSON structure
- **Platform-specific paths**: Windows APPDATA path used for logs (cross-platform support planned)
- **Token estimation**: Without explicit token data, estimates may vary from actual usage
- **Depth limit**: Workspace file scanning limited to 8 directory levels

## Privacy & Security

- **No network requests**: Extension operates entirely offline
- **Local data only**: Reads only from local git, Kiro config, and session files
- **No tracking or telemetry**: Zero analytics or external reporting
- **Transparent operation**: All data sources documented and auditable

## Troubleshooting

**Profile shows "0 files" for languages**
- Ensure a workspace folder is open in Kiro
- Check that code files have recognized extensions

**Activity heatmap is empty**
- Verify git repository exists with commit history
- Check that Kiro session files exist in `~/.kiro/sessions/`
- Try clicking the refresh button

**Share card not saving**
- Check workspace folder is open (default save location)
- Ensure write permissions for workspace directory
- Look for saved images in `kiro-profile-shares/` folder

**Extension not activating**
- Confirm extension is installed and enabled
- Check Kiro compatibility version (^1.92.0)
- Reload window (Command Palette > "Developer: Reload Window")

## License

MIT License - see [LICENSE](LICENSE) file for details

## Changelog

### 0.1.4
- Current stable release

### 0.1.3
- Bug fixes and stability improvements

### 0.1.2
- Enhanced metrics calculation

### 0.1.1
- UI refinements

### 0.1.0
- Initial release with core features

## Author

Published by **jagatees**

## Links

- [Report Issues](https://github.com/jagatees/kiro-profile/issues)
- [Source Code](https://github.com/jagatees/kiro-profile)

---

**Made with ❤️ for the Kiro IDE community**
