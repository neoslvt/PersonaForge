import { useEffect } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { storageService } from '../services/storageService'

export function useSaveDialog() {
  const { currentDialog, currentDialogPath, setCurrentDialog } = useDialogStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        
        if (!currentDialog) return
        
        const saveDialog = async () => {
          try {
            if (!window.electronAPI) {
              alert('File dialog not available. Please use the Save button in the menu.')
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
            const filePath = result.filePath
            
            await storageService.saveDialog(currentDialog, filePath)
            setCurrentDialog(currentDialog, filePath)
          } catch (error) {
            console.error('Save error:', error)
            alert('Failed to save dialog')
          }
        }
        
        saveDialog()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDialog, currentDialogPath, setCurrentDialog])
}

