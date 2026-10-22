import { useToastMessage } from '../lib/toast.ts'
import styles from './Toast.module.css'

function Toaster() {
  const text = useToastMessage()
  return (
    <div role="status" aria-live="polite">
      {text && (
        <div key={text} className={styles.toast}>
          {text}
        </div>
      )}
    </div>
  )
}

export default Toaster
