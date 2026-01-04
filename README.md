# PersonaForge

A powerful dialog tool for creating interactive conversations with AI characters. Built with Electron and React.

## Features

- **Node Graph Editor**: Visualize and edit dialog trees with drag-and-drop nodes
- **Chat Editor**: Linear view of conversations with AI response generation
- **Live Preview**: Preview your dialogs with character and scene visualization
- **Character Management**: Create and manage multiple AI characters with personalities
- **AI Integration**: Generate NPC responses using AI models
- **Scene System**: Associate backgrounds with your dialogs
- **Export/Import**: Save and load dialog trees as JSON files

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- An AI API key (OpenAI, Anthropic, etc.) - configure in the app

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start the Vite dev server for React and launch Electron.

### Build

```bash
npm run build
```

## Usage

1. **Create a Character**: Use the character selector to create a new character with a name, personality, and visual prompt
2. **Create Dialog Nodes**: In the Node Graph view, add nodes and connect them to create conversation branches
3. **Generate AI Responses**: Click "Generate" on player nodes to create NPC responses
4. **Edit Nodes**: Click on node text to edit, or use the Chat view for linear editing
5. **Preview**: Switch to Live Preview to see how your dialog looks
6. **Export**: Save your dialogs as JSON files
