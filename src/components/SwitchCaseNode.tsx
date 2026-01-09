import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface SwitchCaseNodeData {
  node: DialogNode
}

export default function SwitchCaseNode({ data, id }: NodeProps<SwitchCaseNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [switchVariable, setSwitchVariable] = useState(node.switchVariable || '')
  const [newCaseValue, setNewCaseValue] = useState('')

  useEffect(() => {
    setSwitchVariable(node.switchVariable || '')
  }, [node.switchVariable])

  const handleVariableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSwitchVariable(e.target.value)
    },
    []
  )

  const handleVariableBlur = useCallback(() => {
    updateNode(id, { switchVariable: switchVariable || undefined })
  }, [id, switchVariable, updateNode])

  const handleAddCase = useCallback(() => {
    if (!newCaseValue.trim()) return
    
    const numValue = parseFloat(newCaseValue)
    const value = isNaN(numValue) ? newCaseValue : numValue
    
    const cases = node.cases || []
    if (cases.find(c => c.value === value)) {
      alert('Case with this value already exists')
      return
    }
    
    updateNode(id, { 
      cases: [...cases, { value, nodeId: undefined }]
    })
    setNewCaseValue('')
  }, [id, newCaseValue, node.cases, updateNode])

  const handleRemoveCase = useCallback(
    (index: number) => {
      const cases = node.cases || []
      updateNode(id, { cases: cases.filter((_, i) => i !== index) })
    },
    [id, node.cases, updateNode]
  )

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  const cases = node.cases || []

  return (
    <div className="dialog-node dialog-node-switch">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Switch Case</span>
        <button 
          onClick={handleDelete} 
          className="dialog-node-delete" 
          title="Delete node"
        >
          ×
        </button>
      </div>
      
      <div className="dialog-node-content">
        <div className="dialog-node-field">
          <label>Variable:</label>
          <input
            type="text"
            value={switchVariable}
            onChange={handleVariableChange}
            onBlur={handleVariableBlur}
            placeholder="variable_name"
            className="dialog-node-input"
          />
        </div>
        
        <div className="dialog-node-cases">
          <div className="dialog-node-cases-header">Cases:</div>
          {cases.map((caseItem, index) => (
            <div key={index} className="dialog-node-case-item">
              <span className="dialog-node-case-value">{caseItem.value}</span>
              <Handle 
                type="source" 
                position={Position.Bottom} 
                id={`case-${index}`}
                style={{ left: `${(index + 1) * (100 / (cases.length + 1))}%` }}
              />
              <button
                onClick={() => handleRemoveCase(index)}
                className="dialog-node-case-remove"
                title="Remove case"
              >
                ×
              </button>
            </div>
          ))}
          
          <div className="dialog-node-add-case">
            <input
              type="text"
              value={newCaseValue}
              onChange={(e) => setNewCaseValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddCase()
                }
              }}
              placeholder="Case value"
              className="dialog-node-input dialog-node-input-small"
            />
            <button onClick={handleAddCase} className="dialog-node-add-button">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

