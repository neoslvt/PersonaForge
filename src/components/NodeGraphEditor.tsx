import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useDialogStore } from '../store/dialogStore'
import DialogNodeComponent from './DialogNodeComponent'
import NodeChatPanel from './NodeChatPanel'
import LivePreview from './LivePreview'
import { DialogNode } from '../types/models'
import { getAIService } from '../services/aiService'
import { createDialogNode } from '../utils/dialogUtils'
import { generateNodeContext, getLastNPCCharacterId } from '../utils/nodeTree'
import './NodeGraphEditor.css'

const nodeTypes: NodeTypes = {
  dialogNode: DialogNodeComponent,
}

export default function NodeGraphEditor() {
  const {
    currentDialog,
    currentScene,
    characters,
    addNode,
    linkNodes,
    saveToHistory,
    undo,
    redo,
    updateNodePositions,
  } = useDialogStore()

  const [chatNodeId, setChatNodeId] = useState<string | null>(null)
  const [chatStartNodeId, setChatStartNodeId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const initialNodes = useMemo(() => {
    if (!currentDialog) return []
    
    const nodes: Node[] = Object.values(currentDialog.nodes).map((node, index) => {
      const savedPosition = currentDialog.nodePositions?.[node.id]
      const defaultPosition = {
        x: (index % 5) * 250,
        y: Math.floor(index / 5) * 150,
      }
      
      return {
        id: node.id,
        type: 'dialogNode',
        position: savedPosition || defaultPosition,
        data: { node },
      }
    })
    
    return nodes
  }, [currentDialog])

  const initialEdges = useMemo(() => {
    if (!currentDialog) return []
    
    const edges: Edge[] = []
    Object.values(currentDialog.nodes).forEach((node) => {
      node.childNodeIds.forEach((childId) => {
        edges.push({
          id: `${node.id}-${childId}`,
          source: node.id,
          target: childId,
        })
      })
    })
    
    return edges
  }, [currentDialog])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const setNodesRef = useRef(setNodes)
  setNodesRef.current = setNodes

  useEffect(() => {
    if (!currentDialog) return
    
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]))
      
      const updatedNodes = initialNodes.map((node) => {
        const existingPosition = positionMap.get(node.id)
        if (existingPosition) {
          return { ...node, position: existingPosition }
        }
        return node
      })
      
      return updatedNodes
    })
    
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges, currentDialog])

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (currentDialog) {
        updateNodePositions({ [node.id]: node.position })
      }
    },
    [updateNodePositions, currentDialog]
  )

  const handleGenerateResponse = useCallback(
    async (nodeId: string) => {
      if (!currentDialog) return
      
      const node = currentDialog.nodes[nodeId]
      if (!node || node.speaker !== 'player') return
      
      const parentNodeId = node.parentNodeIds[0]
      if (!parentNodeId) {
        alert('No parent NPC node found. Connect this node to an NPC node first.')
        return
      }
      
      const parentNode = currentDialog.nodes[parentNodeId]
      if (!parentNode || parentNode.speaker !== 'NPC') {
        alert('Parent node is not an NPC. Connect to an NPC node first.')
        return
      }
      
      if (!parentNode.characterId) {
        alert('Please select a character for the parent NPC node first.')
        return
      }
      
      const character = characters[parentNode.characterId]
      if (!character) {
        alert('Character not found. Please select a valid character for the NPC node.')
        return
      }
      
      const context = generateNodeContext(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      )
      
      const inheritedCharacterId = getLastNPCCharacterId(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      ) || parentNode.characterId
      
      const aiService = getAIService()
      
      try {
        const response = await aiService.generateNPCResponse(
          context,
          character,
          currentScene || undefined
        )
        
        const newNodeId = `node_${Date.now()}`
        const newNode: DialogNode = {
          id: newNodeId,
          speaker: 'NPC',
          text: response,
          characterId: inheritedCharacterId,
          childNodeIds: [],
          parentNodeIds: [nodeId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        
        addNode(newNode)
        linkNodes(nodeId, newNodeId)
        saveToHistory()
        
        setNodesRef.current((nds) => {
          const existingNode = nds.find((n) => n.id === newNodeId)
          if (existingNode) return nds
          
          const parentNode = nds.find((n) => n.id === nodeId)
          const parentPosition = parentNode?.position || { x: 0, y: 0 }
          
          return [
            ...nds,
            {
              id: newNodeId,
              type: 'dialogNode',
              position: {
                x: parentPosition.x,
                y: parentPosition.y + 150,
              },
              data: { node: newNode },
            },
          ]
        })
      } catch (error) {
        console.error('Error generating AI response:', error)
      }
    },
    [currentDialog, characters, currentScene, addNode, linkNodes, saveToHistory]
  )

  const handleAddPlayerResponse = useCallback(
    (parentNodeId: string) => {
      if (!currentDialog) return
      
      const parentNode = currentDialog.nodes[parentNodeId]
      if (!parentNode || parentNode.speaker !== 'NPC') return
      
      const newNode = createDialogNode('player', '[Player response]', [parentNodeId])
      
      addNode(newNode)
      linkNodes(parentNodeId, newNode.id)
      saveToHistory()
      
      setNodesRef.current((nds) => {
        const existingNode = nds.find((n) => n.id === newNode.id)
        if (existingNode) return nds
        
        const parentFlowNode = nds.find((n) => n.id === parentNodeId)
        const parentPosition = parentFlowNode?.position || { x: 0, y: 0 }
        
        const siblingCount = parentNode.childNodeIds.length
        const newPosition = {
          x: parentPosition.x + (siblingCount > 0 ? siblingCount * 220 : 0),
          y: parentPosition.y + 150,
        }
        
        return [
          ...nds,
          {
            id: newNode.id,
            type: 'dialogNode',
            position: newPosition,
            data: { node: newNode },
          },
        ]
      })
      
      setEdges((eds) => [
        ...eds,
        {
          id: `${parentNodeId}-${newNode.id}`,
          source: parentNodeId,
          target: newNode.id,
        },
      ])
    },
    [currentDialog, addNode, linkNodes, saveToHistory, setEdges]
  )

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setChatNodeId(nodeId)
    setChatStartNodeId(nodeId)
  }, [])

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onGenerate: handleGenerateResponse,
          onAddPlayerResponse: handleAddPlayerResponse,
          onDoubleClick: handleNodeDoubleClick,
        },
      }))
    )
  }, [handleGenerateResponse, handleAddPlayerResponse, handleNodeDoubleClick, setNodes])

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        linkNodes(params.source, params.target)
        setEdges((eds) => addEdge(params, eds))
        saveToHistory()
      }
    },
    [linkNodes, setEdges, saveToHistory]
  )

  const handleAddNode = useCallback(() => {
    if (!currentDialog) return
    
    const newNode = createDialogNode('player', '', [])
    
    addNode(newNode)
    saveToHistory()
    
            if (!currentDialog.rootNodeId) {
              useDialogStore.setState({
                currentDialog: currentDialog ? { ...currentDialog, rootNodeId: newNode.id } : null
              })
            }
    
    setNodes((nds) => {
      const newPosition = {
        x: (nds.length % 5) * 250,
        y: Math.floor(nds.length / 5) * 150,
      }
      
      return [
        ...nds,
        {
          id: newNode.id,
          type: 'dialogNode',
          position: newPosition,
          data: { node: newNode },
        },
      ]
    })
  }, [currentDialog, addNode, saveToHistory, setNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  if (!currentDialog) {
    return (
      <div className="node-graph-empty">
        <p>No dialog loaded. Create a new dialog from the Dialog menu.</p>
      </div>
    )
  }

  return (
    <div className="node-graph-editor">
      <div className="node-graph-toolbar">
        <button onClick={handleAddNode}>Add Node</button>
        <button onClick={undo}>Undo (Ctrl+Z)</button>
        <button onClick={redo}>Redo (Ctrl+Y)</button>
        <button onClick={() => setShowPreview(true)} className="play-button">
          ▶ Play
        </button>
        <div className="node-graph-info">
          <span>Connect nodes by dragging from output (bottom) to input (top)</span>
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        connectionLineStyle={{ stroke: '#007acc', strokeWidth: 2 }}
        defaultEdgeOptions={{ style: { stroke: '#007acc', strokeWidth: 2 } }}
      >
        <Controls />
        <Background />
        <MiniMap />
      </ReactFlow>
      {chatNodeId && (
        <NodeChatPanel
          nodeId={chatNodeId}
          onClose={() => {
            setChatNodeId(null)
            setChatStartNodeId(null)
          }}
          onNodeChange={(newNodeId) => {
            setChatNodeId(newNodeId)
            const latestDialog = useDialogStore.getState().currentDialog
            if (latestDialog && chatStartNodeId) {
              const findDescendants = (nodeId: string, visited: Set<string> = new Set()): string[] => {
                if (visited.has(nodeId)) return []
                visited.add(nodeId)
                
                const node = latestDialog.nodes[nodeId]
                if (!node) return []
                
                const descendants: string[] = [nodeId]
                node.childNodeIds.forEach(childId => {
                  descendants.push(...findDescendants(childId, visited))
                })
                
                return descendants
              }
              
              const descendantIds = new Set(findDescendants(chatStartNodeId))
              
              setNodes((nds) => {
                const existingIds = new Set(nds.map((n) => n.id))
                const newNodes: Node[] = []
                const newNodesMap = new Map<string, Node>()
                
                const startNode = nds.find((n) => n.id === chatStartNodeId)
                if (!startNode) return nds
                
                const allNewNodes = Object.values(latestDialog.nodes).filter(
                  (node) => !existingIds.has(node.id)
                )
                
                const sortedNewNodes: typeof allNewNodes = []
                const remainingNodes = new Set(allNewNodes)
                const processedIds = new Set(existingIds)
                
                while (remainingNodes.size > 0) {
                  let foundAny = false
                  
                  for (const node of remainingNodes) {
                    const parentId = node.parentNodeIds[0]
                    if (!parentId || processedIds.has(parentId)) {
                      sortedNewNodes.push(node)
                      remainingNodes.delete(node)
                      processedIds.add(node.id)
                      foundAny = true
                    }
                  }
                  
                  if (!foundAny) {
                    remainingNodes.forEach(node => {
                      sortedNewNodes.push(node)
                      processedIds.add(node.id)
                    })
                    remainingNodes.clear()
                  }
                }
                
                sortedNewNodes.forEach((node) => {
                  const isDescendant = descendantIds.has(node.id)
                  
                  const parentId = node.parentNodeIds[0]
                  let parentNode: Node | undefined
                  
                  if (parentId) {
                    parentNode = nds.find((n) => n.id === parentId)
                  }
                  
                  if (!parentNode && parentId) {
                    parentNode = newNodesMap.get(parentId)
                  }
                  
                  if (!parentNode && isDescendant) {
                    const currentChatNode = nds.find((n) => n.id === chatNodeId) || startNode
                    parentNode = currentChatNode
                  }
                  
                  if (!parentNode && parentId) {
                    console.warn(`Could not find parent node ${parentId} for node ${node.id}`)
                  }
                  
                  const parentPosition = parentNode?.position || { x: 0, y: 0 }
                  
                  const newPosition = {
                    x: parentPosition.x,
                    y: parentPosition.y + 150,
                  }
                  
                  const newNode: Node = {
                    id: node.id,
                    type: 'dialogNode',
                    position: newPosition,
                    data: { node },
                  }
                  
                  newNodes.push(newNode)
                  newNodesMap.set(node.id, newNode)
                })
                
                if (newNodes.length > 0) {
                  const positionsToSave: Record<string, { x: number; y: number }> = {}
                  newNodes.forEach((n) => {
                    positionsToSave[n.id] = n.position
                  })
                  updateNodePositions(positionsToSave)
                }
                
                return [...nds, ...newNodes]
              })
              
              setEdges((eds) => {
                const existingEdgeIds = new Set(eds.map((e) => e.id))
                const newEdges: Edge[] = []
                
                Object.values(latestDialog.nodes).forEach((node) => {
                  node.childNodeIds.forEach((childId) => {
                    const edgeId = `${node.id}-${childId}`
                    if (!existingEdgeIds.has(edgeId)) {
                      newEdges.push({
                        id: edgeId,
                        source: node.id,
                        target: childId,
                      })
                    }
                  })
                })
                
                return [...eds, ...newEdges]
              })
            }
          }}
        />
      )}
      {showPreview && (
        <div className="node-graph-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="node-graph-preview-container" onClick={(e) => e.stopPropagation()}>
            <div className="node-graph-preview-header">
              <h3>Live Preview</h3>
              <button 
                className="node-graph-preview-close"
                onClick={() => setShowPreview(false)}
                title="Close Preview"
              >
                ×
              </button>
            </div>
            <div className="node-graph-preview-content">
              <LivePreview />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
