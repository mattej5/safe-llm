# SafeLLM Agent

A powerful, interactive CLI agent built with [Mastra](https://mastra.ai/) and designed to work seamlessly with local LLM providers like **LM Studio** and **Ollama**. SafeLLM provides a robust chat interface with session persistence, long-term memory, markdown rendering, and advanced CLI features like typeahead and ghost text.

## ✨ Features

- **🧠 Session Persistence**: Automatically saves and restores chat history in `.safellm/` directory.
- **📚 Long-Term Memory**: The agent can save, read, and remember facts about you across different sessions using a dedicated `MEMORY.md` file.
- **🔌 Provider Support**: Out-of-the-box support for LM Studio and Ollama, plus custom OpenAI-compatible endpoints.
- **🖥️ Interactive CLI**: 
  - **Rich Markdown**: Beautifully rendered text with headings, code blocks, and lists.
  - **Ghost Text**: Intelligent command autocomplete suggestions (use `Right Arrow` to accept).
  - **Thinking Process**: Visualizes the model's "Chain of Thought" or reasoning process in a distinct style.
- **⚡ Mastra Tools**: Extensible architecture using Mastra tools for weather, time, and filesystem memory.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A local LLM server:
  - **[LM Studio](https://lmstudio.ai/)**: Best for a GUI-driven experience and easy model management.
  - **[Ollama](https://ollama.com/)**: Best for a lightweight, CLI-driven experience.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/safellm-agent.git
   cd safellm-agent
   ```

2. **Run with Docker (Recommended)**:
   This runs the agent in a secure, sandboxed container while still allowing access to your local LLMs.
   ```bash
   ./safellm
   ```


3. **Or Run Locally**:
   ```bash
   npm install
   npm start
   ```

### 🐳 Docker Support

The agent is designed to run in a container.
- **Persistence**: Your sessions (`.safellm/`) and memory (`MEMORY.md`) are mounted to your host machine, so data survives container restarts.
- **Networking**: The container is pre-configured to reach your host's LLM server using `host.docker.internal`.
  - **Important**: When running in Docker, ensure your `config.json` points to `http://host.docker.internal:1234/v1` (for LM Studio) or `http://host.docker.internal:11434/v1` (for Ollama).

## 🛠️ Usage

### Starting the Agent

Run the following command to start the agent. If it's your first time, the **Setup Wizard** will launch automatically.

```bash
npm start
```

### Keyboard Shortcuts

- **Right Arrow (`→`)**: Accept the ghost text suggestion (e.g., when typing `/lo` -> `/load `).
- **Up/Down Arrow**: Navigate command history.

### Slash Commands

The agent supports several slash commands to enhance your workflow:

| Command | Description |
| :--- | :--- |
| `/help` | Display the help menu with all available commands. |
| `/config` | Re-run the setup wizard to change providers or models. |
| `/clear` | Clear the current terminal screen and start a fresh context. |
| `/history` | View a list of your previous chat sessions with IDs and timestamps. |
| `/load <id>` | Load a specific session by its ID to resume a conversation. |
| `/rename <name>` | Rename the current active session for easier identification. |
| `/exit` | Save the session and exit the application. |

## 🧩 Tools & Capabilities

The agent is equipped with several tools it can use autonomously to assist you.

### 🧠 Memory System
The agent has a persistence layer rooted in `MEMORY.md` in your project folder.
- **Save Memory**: It can store user preferences, facts, or tasks (e.g., "Remember I like Python").
- **Read Memory**: It retrieves these facts to provide personalized responses.
- **Update/Delete**: It can modify or remove outdated information.

### 🛠️ Utility Tools
- **Weather**: Gets current weather information for a specified location.
- **Time**: Gets the current local time and timezone.

## ⚙️ Configuration

Your settings are stored in `config.json` in the project root. You can manually edit this file or use `/config` in the chat to update:

- **Provider**: `lm-studio`, `ollama`, or `custom`.
- **Base URL**: The endpoint for your LLM server (e.g., `http://localhost:1234/v1`).
- **Model ID**: The specific model to use (e.g., `mistralai/ministral-3-14b-reasoning`).
- **API Key**: Required if you enable authentication on your local server.

## ❓ Troubleshooting

**"Connection failed to..."**
- Ensure your Local LLM provider is running.
- **LM Studio**: Check that the Local Server is started (green bar).
- **Ollama**: Ensure `ollama serve` is running in a terminal.
- Check if the port matches your config (`1234` for LM Studio, `11434` for Ollama).

**"Empty response generated"**
- The model might be failing to generate text. Try restarting the local server.
- Ensure you have a model loaded in your provider.

**TypeScript Errors**
- If you see type errors during build (`npx tsc`), ensure you are using a recent version of TypeScript and that `node_modules` are clean. Try `rm -rf node_modules && npm install`.

## 🏗️ Development

### Project Structure

- `src/index.ts`: The main entry point and chat loop.
- `src/config-wizard.ts`: Handles CLI setup and server health checks.
- `src/session-manager.ts`: Manages session loading, saving, and history JSONs.
- `src/tools.ts`: Definitions for Mastra tools (Weather, Memory, etc.).

### Building from Source

```bash
# Compile TypeScript
npx tsc

# Run with tsx (development)
npm start
```

## 📄 License

This project is licensed under the ISC License.
