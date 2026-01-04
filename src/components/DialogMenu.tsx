import { useCallback, useState } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { storageService } from '../services/storageService'
import { createNewDialog } from '../utils/dialogUtils'
import './DialogMenu.css'

export default function DialogMenu() {
  const { currentDialog, currentDialogPath, setCurrentDialog, recentDialogs, addScene, setCurrentScene } = useDialogStore()
  const [isOpen, setIsOpen] = useState(false)

  const handleNewDialog = useCallback(() => {
    const newDialog = createNewDialog()
    setCurrentDialog(newDialog, undefined)
    setIsOpen(false)
  }, [setCurrentDialog])

  const handleSave = useCallback(async () => {
    if (!currentDialog) {
      alert('No dialog to save')
      return
    }

    try {
      let filePath: string | undefined
      
      if (!window.electronAPI) {
        alert('File dialog not available. Please use Save As instead.')
        return
      }

      const defaultPath = currentDialogPath || `dialog_${currentDialog.id}.json`
      
      const result = await window.electronAPI.showSaveDialog({
        title: 'Save Dialog',
        defaultPath: defaultPath,
        filters: [
          { name: 'Dialog Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      
      if (result.canceled || !result.filePath) return
      filePath = result.filePath
      
      await storageService.saveDialog(currentDialog, filePath)
      setCurrentDialog(currentDialog, filePath)
      setIsOpen(false)
      alert('Dialog saved successfully!')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save dialog')
    }
  }, [currentDialog, currentDialogPath, setCurrentDialog])

  const handleSaveAs = useCallback(async () => {
    if (!currentDialog) {
      alert('No dialog to save')
      return
    }

    try {
      if (!window.electronAPI) {
        alert('File dialog not available in this environment.')
        return
      }

      const defaultPath = currentDialogPath || `dialog_${currentDialog.id}.json`
      
      const result = await window.electronAPI.showSaveDialog({
        title: 'Save Dialog As',
        defaultPath: defaultPath,
        filters: [
          { name: 'Dialog Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      
      if (result.canceled || !result.filePath) return
      const filePath = result.filePath
      
      await storageService.saveDialog(currentDialog, filePath)
      setCurrentDialog(currentDialog, filePath)
      setIsOpen(false)
      alert('Dialog saved successfully!')
    } catch (error) {
      console.error('Save As error:', error)
      alert('Failed to save dialog')
    }
  }, [currentDialog, currentDialogPath, setCurrentDialog])

  const handleOpen = useCallback(async () => {
    try {
      let filePath: string | undefined
      
      if (!window.electronAPI) {
        filePath = prompt('Enter dialog file path:')
        if (!filePath) return
      } else {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Open Dialog',
          filters: [
            { name: 'Dialog Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        })
        
        if (result.canceled || !result.filePaths?.length) return
        filePath = result.filePaths[0]
      }
      
      const dialog = await storageService.loadDialog(filePath!)
      setCurrentDialog(dialog, filePath!)
      
      if (dialog.sceneId) {
        try {
          const scene = await storageService.loadScene(dialog.sceneId)
          addScene(scene)
          setCurrentScene(scene)
        } catch (error) {
          console.warn('Failed to load scene:', error)
        }
      }
      
      setIsOpen(false)
      alert('Dialog loaded successfully!')
    } catch (error) {
      console.error('Open error:', error)
      alert('Failed to load dialog')
    }
  }, [setCurrentDialog, addScene, setCurrentScene])

  const handleOpenRecent = useCallback(async (recentPath: string) => {
    try {
      const dialog = await storageService.loadDialog(recentPath)
      setCurrentDialog(dialog, recentPath)
      
      if (dialog.sceneId) {
        try {
          const scene = await storageService.loadScene(dialog.sceneId)
          addScene(scene)
          setCurrentScene(scene)
        } catch (error) {
          console.warn('Failed to load scene:', error)
        }
      }
      
      setIsOpen(false)
    } catch (error) {
      console.error('Open recent error:', error)
      alert('Failed to load dialog. It may have been moved or deleted.')
    }
  }, [setCurrentDialog, addScene, setCurrentScene])

  const handleExport = useCallback(() => {
    if (!currentDialog) {
      alert('No dialog to export')
      return
    }

    try {
      const jsonString = JSON.stringify(currentDialog, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `dialog_${currentDialog.id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
      
      setIsOpen(false)
      alert('Dialog exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export dialog')
    }
  }, [currentDialog])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const dialog = JSON.parse(text) as any
        
        if (!dialog || typeof dialog !== 'object' || !dialog.id || !dialog.nodes) {
          alert('Invalid dialog file. Please select a valid dialog JSON file.')
          return
        }
        
        if (dialog.rootNodeId && !dialog.nodes[dialog.rootNodeId]) {
          console.warn('Root node ID points to non-existent node, clearing rootNodeId')
          dialog.rootNodeId = null
        }
        
        if (!dialog.rootNodeId && Object.keys(dialog.nodes).length > 0) {
          const rootNode = Object.values(dialog.nodes).find((node: any) => 
            !node.parentNodeIds || node.parentNodeIds.length === 0
          ) as any
          if (rootNode) {
            dialog.rootNodeId = rootNode.id
          }
        }
        
        setCurrentDialog(dialog, undefined)
        
        if (dialog.sceneId) {
          try {
            const scene = await storageService.loadScene(dialog.sceneId)
            addScene(scene)
            setCurrentScene(scene)
          } catch (error) {
            console.warn('Failed to load scene:', error)
          }
        }
        
        setIsOpen(false)
        alert('Dialog imported successfully!')
      } catch (error) {
        console.error('Import error:', error)
        alert('Failed to import dialog. Please ensure the file is valid JSON.')
      } finally {
        document.body.removeChild(input)
      }
    }
    
    document.body.appendChild(input)
    input.click()
  }, [setCurrentDialog, addScene, setCurrentScene])

  return (
    <div className="dialog-menu">
      <button
        className="dialog-menu-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        Dialog
      </button>
      
      {isOpen && (
        <>
          <div className="dialog-menu-overlay" onClick={() => setIsOpen(false)} />
          <div className="dialog-menu-dropdown">
            <button onClick={handleNewDialog} className="dialog-menu-item">
              New Dialog
            </button>
            <button onClick={handleOpen} className="dialog-menu-item">
              Open...
            </button>
            <button onClick={handleSave} className="dialog-menu-item" disabled={!currentDialog}>
              Save {currentDialogPath ? '(Ctrl+S)' : ''}
            </button>
            <button onClick={handleSaveAs} className="dialog-menu-item" disabled={!currentDialog}>
              Save As...
            </button>
            
            <div className="dialog-menu-divider" />
            
            <button onClick={handleExport} className="dialog-menu-item" disabled={!currentDialog}>
              Export JSON...
            </button>
            <button onClick={handleImport} className="dialog-menu-item">
              Import JSON...
            </button>
            
            {recentDialogs.length > 0 && (
              <>
                <div className="dialog-menu-divider" />
                <div className="dialog-menu-section-title">Recent</div>
                {recentDialogs.map((recent) => (
                  <button
                    key={recent.path}
                    onClick={() => handleOpenRecent(recent.path)}
                    className="dialog-menu-item dialog-menu-recent"
                    title={recent.path}
                  >
                    {recent.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
