/**
 * Empty state when no alerts have been triggered
 */
export function EmptyAlertHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">🔕</div>
      <h3 className="text-xl font-semibold text-gray-200 mb-2">
        No alerts in the last 24 hours
      </h3>
      <p className="text-gray-400 text-center max-w-md">
        Alerts will appear here when market conditions match your configured rules.
        Enable alerts in the settings to start monitoring.
      </p>
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-300">
          💡 <span className="font-medium">Tip:</span> Configure alert rules to get notified about:
        </p>
        <ul className="mt-2 text-sm text-gray-400 space-y-1 ml-6">
          <li>• Pioneer Bull/Bear signals</li>
          <li>• Price pumps and dumps</li>
          <li>• Volume spikes</li>
          <li>• Custom thresholds</li>
        </ul>
      </div>
    </div>
  )
}
