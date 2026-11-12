/**
 * The daily-email switch.
 *
 * Off unless the account turned it on — at signup, or here. Used in the free
 * view and in the paying app's settings; the email a subscriber gets carries
 * the levels, the one a free account gets does not, so the description is
 * passed in rather than written here.
 */
import { useDigestPreference } from '@/hooks/useFreeAccount'

export function DigestSwitch({ description }: { description: string }) {
  const { digest, isLoading, isError, isSaving, setDigest } = useDigestPreference()
  const on = digest === true

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p id="digest-switch-label" className="text-sm font-medium text-white">
          Daily scan by email
        </p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-gray-400">{description}</p>
        {isError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            That could not be saved. Try again in a moment.
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="digest-switch-label"
        // Unknown until the first read returns; a switch that guessed "off"
        // and then jumped would invite a click on the wrong state.
        disabled={isLoading || isSaving || digest === undefined}
        onClick={() => setDigest(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623] disabled:opacity-50 ${
          on ? 'bg-[#f5a623]' : 'bg-gray-700'
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            on ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}
