import { useState } from 'react'
import { useDialogStore } from './store/dialogStore'
import NodeGraphEditor from './components/NodeGraphEditor'
import ChatEditor from './components/ChatEditor'
import LivePreview from './components/LivePreview'
import CharacterSelector from './components/CharacterSelector'
import DialogMenu from './components/DialogMenu'
import SettingsPanel from './components/SettingsPanel'
import { useSaveDialog } from './hooks/useSaveDialog'
import './App.css'

type Tab = 'graph' | 'chat' | 'preview'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('graph')
  const [showSettings, setShowSettings] = useState(false)
  useSaveDialog()

  return (
    <div className="app">
      <div className="app-header">
        <h1>PersonaForge</h1>
        <div className="header-actions">
          <DialogMenu />
          <CharacterSelector />
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>
      
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      <div className="app-content">
        {activeTab === 'graph' && <NodeGraphEditor />}
        {activeTab === 'chat' && <ChatEditor />}
        {activeTab === 'preview' && <LivePreview />}
      </div>
    </div>
  )
}

export default App

