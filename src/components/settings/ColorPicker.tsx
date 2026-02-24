import { useState, useCallback } from 'react'
import { isValidHexColor } from '@/types/alertColors'

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  label: string
}

/**
 * Compact color picker with hex input and native color swatch.
 */
export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(color)
  const [isInvalid, setIsInvalid] = useState(false)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)
      if (isValidHexColor(val)) {
        setIsInvalid(false)
        onChange(val)
      } else {
        setIsInvalid(val.length === 7) // only flag when fully typed
      }
    },
    [onChange],
  )

  const handleNativeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)
      setIsInvalid(false)
      onChange(val)
    },
    [onChange],
  )

  // Sync external color changes
  if (color !== inputValue && isValidHexColor(color) && !isInvalid) {
    setInputValue(color)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Native color square */}
      <label className="relative w-7 h-7 rounded border border-gray-600 cursor-pointer overflow-hidden flex-shrink-0">
        <input
          type="color"
          value={color}
          onChange={handleNativeChange}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        />
        <span
          className="block w-full h-full rounded"
          style={{ backgroundColor: color }}
        />
      </label>

      {/* Label */}
      <span className="text-sm text-gray-300 min-w-[120px]">{label}</span>

      {/* Hex input */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        maxLength={7}
        className={`w-[90px] px-2 py-1 text-xs font-mono rounded border bg-gray-800 text-gray-200 outline-none transition-colors ${
          isInvalid
            ? 'border-red-500 focus:border-red-400'
            : 'border-gray-600 focus:border-accent'
        }`}
        placeholder="#RRGGBB"
      />
    </div>
  )
}
