import { create } from 'zustand'
import { produce } from 'immer'
import { Dialog, DialogNode, Character, Scene } from '../types/models'

interface DialogState {
  currentDialog: Dialog | null
  currentDialogPath: string | null
  currentCharacter: Character | null
  currentScene: Scene | null
  characters: Record<string, Character>
  scenes: Record<string, Scene>
  history: Dialog[]
  historyIndex: number
  recentDialogs: Array<{ path: string; name: string; lastOpened: number }>
  
  setCurrentDialog: (dialog: Dialog | null, path?: string | null) => void
  setCurrentCharacter: (character: Character | null) => void
  setCurrentScene: (scene: Scene | null) => void
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  addScene: (scene: Scene) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  
  addNode: (node: DialogNode) => void
  updateNode: (nodeId: string, updates: Partial<DialogNode>) => void
  deleteNode: (nodeId: string) => void
  linkNodes: (parentId: string, childId: string) => void
  unlinkNodes: (parentId: string, childId: string) => void
  
  saveToHistory: () => void
  undo: () => void
  redo: () => void
  
  updateNodePositions: (positions: Record<string, { x: number; y: number }>) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  currentDialog: null,
  currentDialogPath: null,
  currentCharacter: null,
  currentScene: null,
  characters: {},
  scenes: {},
  history: [],
  historyIndex: -1,
  recentDialogs: [],
  
  setCurrentDialog: (dialog, path) =>
    set(
      produce((state: DialogState) => {
        if (!dialog) {
          state.currentDialog = null
          state.currentDialogPath = null
          return
        }
        
        if (dialog.rootNodeId && !dialog.nodes[dialog.rootNodeId]) {
          dialog.rootNodeId = null
        }
        
        if (!dialog.rootNodeId && Object.keys(dialog.nodes || {}).length > 0) {
          const rootNode = Object.values(dialog.nodes).find((node: any) => 
            !node.parentNodeIds || node.parentNodeIds.length === 0
          ) as any
          if (rootNode) {
            dialog.rootNodeId = rootNode.id
          }
        }
        
        state.currentDialog = dialog
        state.currentDialogPath = path ?? null
        
        if (dialog?.sceneId && state.scenes[dialog.sceneId]) {
          state.currentScene = state.scenes[dialog.sceneId]
        } else if (dialog && !dialog.sceneId) {
          state.currentScene = null
        }
        
        if (path) {
          const recent = state.recentDialogs.filter((d) => d.path !== path)
          const fileName = path.split(/[/\\]/).pop() || 'Untitled'
          recent.unshift({ path, name: fileName, lastOpened: Date.now() })
          const updatedRecent = recent.slice(0, 10)
          state.recentDialogs = updatedRecent
          if (typeof window !== 'undefined') {
            localStorage.setItem('personaForge_recentDialogs', JSON.stringify(updatedRecent))
          }
        }
      })
    ),
  setCurrentCharacter: (character) => set({ currentCharacter: character }),
  setCurrentScene: (scene) =>
    set(
      produce((state: DialogState) => {
        state.currentScene = scene
        if (state.currentDialog && scene) {
          state.currentDialog.sceneId = scene.id
          state.currentDialog.updatedAt = Date.now()
        } else if (state.currentDialog && !scene) {
          delete state.currentDialog.sceneId
          state.currentDialog.updatedAt = Date.now()
        }
      })
    ),
  
  addCharacter: (character) =>
    set(
      produce((state: DialogState) => {
        state.characters[character.id] = character
      })
    ),
  
  updateCharacter: (id, updates) =>
    set(
      produce((state: DialogState) => {
        if (state.characters[id]) {
          state.characters[id] = { ...state.characters[id], ...updates, updatedAt: Date.now() }
        }
        if (state.currentCharacter?.id === id) {
          state.currentCharacter = { ...state.currentCharacter, ...updates, updatedAt: Date.now() }
        }
      })
    ),
  
  addScene: (scene) =>
    set(
      produce((state: DialogState) => {
        state.scenes[scene.id] = scene
      })
    ),
  
  updateScene: (id, updates) =>
    set(
      produce((state: DialogState) => {
        if (state.scenes[id]) {
          state.scenes[id] = { ...state.scenes[id], ...updates, updatedAt: Date.now() }
        }
        if (state.currentScene?.id === id) {
          state.currentScene = { ...state.currentScene, ...updates, updatedAt: Date.now() }
        }
      })
    ),
  
  addNode: (node) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        state.currentDialog.nodes[node.id] = node
        if (!state.currentDialog.rootNodeId) {
          state.currentDialog.rootNodeId = node.id
        }
        state.currentDialog.updatedAt = Date.now()
      })
    ),
  
  updateNode: (nodeId, updates) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog || !state.currentDialog.nodes[nodeId]) return
        state.currentDialog.nodes[nodeId] = {
          ...state.currentDialog.nodes[nodeId],
          ...updates,
          updatedAt: Date.now(),
        }
        state.currentDialog.updatedAt = Date.now()
      })
    ),
  
  deleteNode: (nodeId) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        const node = state.currentDialog.nodes[nodeId]
        if (!node) return
        
        node.parentNodeIds.forEach((parentId) => {
          const parent = state.currentDialog!.nodes[parentId]
          if (parent) {
            parent.childNodeIds = parent.childNodeIds.filter((id) => id !== nodeId)
          }
        })
        
        node.childNodeIds.forEach((childId) => {
          const child = state.currentDialog!.nodes[childId]
          if (child) {
            child.parentNodeIds = child.parentNodeIds.filter((id) => id !== nodeId)
          }
        })
        
        delete state.currentDialog.nodes[nodeId]
        state.currentDialog.updatedAt = Date.now()
      })
    ),
  
  linkNodes: (parentId, childId) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        const parent = state.currentDialog.nodes[parentId]
        const child = state.currentDialog.nodes[childId]
        if (!parent || !child) return
        
        if (!parent.childNodeIds.includes(childId)) {
          parent.childNodeIds.push(childId)
        }
        if (!child.parentNodeIds.includes(parentId)) {
          child.parentNodeIds.push(parentId)
        }
        state.currentDialog.updatedAt = Date.now()
      })
    ),
  
  unlinkNodes: (parentId, childId) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        const parent = state.currentDialog.nodes[parentId]
        const child = state.currentDialog.nodes[childId]
        if (!parent || !child) return
        
        parent.childNodeIds = parent.childNodeIds.filter((id) => id !== childId)
        child.parentNodeIds = child.parentNodeIds.filter((id) => id !== parentId)
        state.currentDialog.updatedAt = Date.now()
      })
    ),
  
  saveToHistory: () =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        state.history = state.history.slice(0, state.historyIndex + 1)
        state.history.push(JSON.parse(JSON.stringify(state.currentDialog)))
        state.historyIndex = state.history.length - 1
        if (state.history.length > 50) {
          state.history.shift()
          state.historyIndex--
        }
      })
    ),
  
  undo: () =>
    set(
      produce((state: DialogState) => {
        if (state.historyIndex > 0) {
          state.historyIndex--
          state.currentDialog = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        }
      })
    ),
  
  redo: () =>
    set(
      produce((state: DialogState) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++
          state.currentDialog = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        }
      })
    ),
  
  updateNodePositions: (positions) =>
    set(
      produce((state: DialogState) => {
        if (!state.currentDialog) return
        if (!state.currentDialog.nodePositions) {
          state.currentDialog.nodePositions = {}
        }
        Object.assign(state.currentDialog.nodePositions, positions)
        state.currentDialog.updatedAt = Date.now()
      })
    ),
}))

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('personaForge_recentDialogs')
    if (saved) {
      const recent = JSON.parse(saved)
      useDialogStore.setState({ recentDialogs: recent })
    }
  } catch (error) {
    console.error('Failed to load recent dialogs:', error)
  }
}

