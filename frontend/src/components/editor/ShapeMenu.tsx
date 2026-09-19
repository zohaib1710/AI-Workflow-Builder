import { NODE_CREATION_PRESETS, type NodeCreationPresetId } from "../../editor/types"

export interface ShapeMenuProps {
  disabled: boolean
  onSelect: (presetId: NodeCreationPresetId) => void
}

function ShapeMenu({ disabled, onSelect }: ShapeMenuProps) {
  return (
    <div className="shape-menu" role="menu" aria-label="Node shapes">
      {NODE_CREATION_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => onSelect(preset.id)}
          className="shape-menu__item"
        >
          <span className="shape-menu__marker" aria-hidden="true" data-shape={preset.shape} />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ShapeMenu
