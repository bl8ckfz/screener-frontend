import { useState } from 'react'
import { Download, FileText, FileJson } from 'lucide-react'
import { exportToCSV, exportToJSON, generateFilename } from '@/utils'
import type { Coin } from '@/types/coin'

interface ExportButtonProps {
  coins: Coin[]
  disabled?: boolean
}

export function ExportButton({ coins, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleExportCSV = () => {
    const filename = generateFilename('pulsaryx', 'csv')
    exportToCSV(coins, filename)
    setIsOpen(false)
  }

  const handleExportJSON = () => {
    const filename = generateFilename('pulsaryx', 'json')
    exportToJSON(coins, filename)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || coins.length === 0}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
        aria-label="Export data"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">Export</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors duration-200 text-left"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-white">Export CSV</div>
                <div className="text-xs text-gray-400">Spreadsheet format</div>
              </div>
            </button>

            <div className="border-t border-gray-700" />

            <button
              onClick={handleExportJSON}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors duration-200 text-left"
            >
              <FileJson className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-white">Export JSON</div>
                <div className="text-xs text-gray-400">Data format</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
