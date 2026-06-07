# Complete Stats Reference - Kiro Activity Insights

## 📋 All Available Statistics

### **Profile Header**
- Display Name
- Username
- Plan Label
- Initials (avatar)

---

## **Top Metrics Row** (5 Cards)
1. **Kiro Opens (30d)** - Launches in last 30 days
2. **Est. Tokens** - Total token usage (highlighted)
3. **Peak Token Day** - Highest single-day usage
4. **Credits** - Total credits consumed
5. **Current Streak** - Consecutive active days

---

## **Activity Heatmap Section**
- GitHub-style contribution calendar
- Daily token counts for the year
- Year selector dropdown
- Visual intensity levels (5 colors)
- Weekday labels
- Month labels
- Activity legend

**Metrics:**
- Daily activity visualization
- Token distribution over time
- Active vs inactive days
- Yearly comparison capability

---

## **Activity Insights Panel**
4 insight cards showing:
1. Kiro launch summary
2. Top programming language
3. Peak daily tokens
4. Best streak achievement

**Format:** Icon + Title + Detail text

---

## **Languages Panel**
- Top 5 programming languages
- File count per language
- Visual tiles with language abbreviations
- Hover tooltips with full names

**Languages Supported:** 25+ including:
- TypeScript, JavaScript, Python, Java
- Go, Rust, C++, C#, PHP, Ruby
- Swift, Kotlin, Dart, HTML, CSS
- JSON, Markdown, YAML, and more

---

## **AI Models Panel**
- Top 4 most-used models
- Session count per model
- Percentage bar graphs
- Model name formatting
- Visual progress bars

**Tracked From:**
- Session model_info fields
- Selected model in settings
- Token generation logs

---

## **Session Statistics Panel** ⭐ NEW
5 key session metrics:
1. **Total Turns** - All conversation turns
2. **Success Rate** - % of successful turns
3. **Failed Turns** - Error count
4. **Avg Session Duration** - Time per session
5. **Sub-agent Calls** - Delegated tasks

**Data Sources:**
- turn_duration fields
- error/status indicators
- session timestamps
- sub-agent invocations

---

## **Token Breakdown Panel** ⭐ NEW
5 token metrics:
1. **Total Tokens** - Complete usage
2. **Prompt Tokens** - Input tokens
3. **Generated Tokens** - Output tokens
4. **Prompt/Generated Ratio** - Efficiency metric
5. **Avg Context Window** - Memory usage

**Calculated From:**
- input_token_count
- output_token_count
- context_token_count
- Aggregate statistics

---

## **Activity Patterns Panel** ⭐ NEW
5 time-based insights:
1. **Most Active Hour** - Peak productivity time
2. **Total Active Days** - Days with activity
3. **Current Streak** - Ongoing streak
4. **Longest Streak** - Best ever
5. **Avg Activity/Day** - Turns per day

**Analysis:**
- Hourly activity distribution (0-23)
- Streak calculation algorithms
- Daily averages computation
- Pattern detection

---

## **Top Tools Used Panel** ⭐ NEW
- Top 5 most-used tools
- Usage count per tool
- Tool name display
- Frequency ranking

**Tool Categories Tracked:**
- File operations (read, write, search)
- Code tools (semanticRename, readCode)
- Shell commands (execute_pwsh)
- Web tools (web_search, web_fetch)
- Sub-agents (invoke_sub_agent)
- MCP server tools

---

## **System Stats Panel** ⭐ NEW
5 system metrics:
1. **Errors Logged** - Error count
2. **Warnings Logged** - Warning count
3. **Hooks Installed** - Agent hooks count
4. **Powers Installed** - Active powers
5. **Extensions Installed** - Extension count

**Sources:**
- `~/.kiro/hooks/*.hook` files
- `~/.kiro/powers/installed.json`
- `~/.kiro/extensions/` folders
- Session error/warning flags

---

## **Legacy Insights List** (Original)
13 metrics in detailed list:
1. Kiro launches (30d)
2. Local sessions
3. Estimated tokens
4. Peak token day
5. Credits recorded
6. Average turn length
7. Most used language
8. Longest streak
9. Active days tracked
10. Hooks installed
11. Powers installed
12. Extensions installed
13. Largest session size

---

## 📊 **Statistics Summary**

### Total Stat Count: **55+ individual metrics**

**Breakdown by Category:**
- **Profile & Identity:** 4 stats
- **Activity Metrics:** 8 stats
- **Heatmap Data:** 365+ data points
- **Language Stats:** Up to 25 languages tracked
- **Model Stats:** Top 4 models with percentages
- **Session Stats:** 5 metrics ⭐
- **Token Stats:** 5 metrics ⭐
- **Activity Patterns:** 5 metrics ⭐
- **Tool Usage:** Top 5 tools ⭐
- **System Stats:** 5 metrics ⭐
- **Legacy Insights:** 13 metrics

### Data Collection Points:
- ✅ Kiro application logs
- ✅ Session JSON files
- ✅ Workspace session files
- ✅ Token generation logs
- ✅ Git commit history
- ✅ Workspace file structure
- ✅ Kiro configuration files
- ✅ Hook files
- ✅ Power metadata
- ✅ Extension folders

---

## 🎨 **UI Layout**

```
┌─────────────────────────────────────────┐
│  Header (Name, Avatar, Sync)            │
├─────────────────────────────────────────┤
│  5 Metric Cards (Top Stats)             │
├─────────────────────────────────────────┤
│  ┌──────────────────┬─────────────────┐ │
│  │  Heatmap         │  Insights       │ │
│  └──────────────────┴─────────────────┘ │
├─────────────────────────────────────────┤
│  ┌──────────────────┬─────────────────┐ │
│  │  Languages       │  Models         │ │
│  └──────────────────┴─────────────────┘ │
├─────────────────────────────────────────┤
│  ┌──────────────────┬─────────────────┐ │
│  │  Session Stats   │  Token Stats    │ │ ⭐ NEW
│  └──────────────────┴─────────────────┘ │
├─────────────────────────────────────────┤
│  ┌──────────────────┬─────────────────┐ │
│  │  Activity        │  Top Tools      │ │ ⭐ NEW
│  │  Patterns        │                 │ │
│  └──────────────────┴─────────────────┘ │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │  System Stats                     │  │ ⭐ NEW
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🔄 **Data Update Frequency**

**Real-time updates when:**
- Clicking refresh button
- Opening the profile panel
- After Kiro session ends

**Data freshness:**
- Git commits: Last 365 days
- Kiro launches: Last 30 days
- Session data: All available history
- Heatmap: Current year (selectable)

---

## 💾 **File Locations**

### Windows Paths:
```
%APPDATA%\Kiro\logs\                      → Launch timestamps
%APPDATA%\Kiro\User\settings.json         → Selected model
%APPDATA%\Kiro\User\globalStorage\...     → Workspace sessions
  └─ kiro.kiroagent\workspace-sessions\
  └─ kiro.kiroagent\dev_data\tokens_generated.jsonl

~\.kiro\sessions\                         → Session JSON files
~\.kiro\hooks\                            → Hook files
~\.kiro\powers\installed.json             → Power metadata
~\.kiro\extensions\                       → Extension folders
```

---

## 🎯 **Key Improvements in v0.2.0**

### Before (v0.1.x):
- Basic stats only
- Limited insights
- No tool tracking
- No time patterns
- No success metrics

### After (v0.2.0):
✅ **30+ new statistics**
✅ **5 new stat sections**
✅ **Tool usage tracking**
✅ **Hourly activity patterns**
✅ **Success rate calculations**
✅ **Token breakdown analysis**
✅ **Session duration tracking**
✅ **Sub-agent invocation counts**
✅ **Error/warning monitoring**

---

**All data remains 100% local and private! 🔒**
