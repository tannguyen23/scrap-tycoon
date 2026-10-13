import { formatShort } from '@core/format'
import type { OfflineReport } from '@domain/systems/offline'
import { UI, formatDuration } from '@i18n/text'
import { useLocale, useText } from '@ui/hooks'

export interface OfflineModalProps {
  report: OfflineReport
  onClose: () => void
}

export function OfflineModal({ report, onClose }: OfflineModalProps) {
  const text = useText()
  const locale = useLocale()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{text(UI.offlineTitle)}</h2>
        <p>
          {text(UI.offlineBody, {
            time: formatDuration(report.effectiveSeconds, locale),
            amount: formatShort(report.earned),
          })}
        </p>
        {report.elapsedSeconds > report.effectiveSeconds && (
          <p className="modal-note">
            {text(UI.offlineCapped, { time: formatDuration(report.effectiveSeconds, locale) })}
          </p>
        )}
        <button type="button" onClick={onClose}>
          {text(UI.ok)}
        </button>
      </div>
    </div>
  )
}
