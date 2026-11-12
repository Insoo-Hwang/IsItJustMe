import { useNavigate } from 'react-router'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { CONTACT_EMAIL, EFFECTIVE_DATE, PRIVACY, TERMS } from '../data/legal.ts'
import styles from './LegalPage.module.css'

const DOCS = {
  privacy: { title: '개인정보처리방침', sections: PRIVACY, other: { to: '/terms', label: '이용약관' } },
  terms: { title: '이용약관', sections: TERMS, other: { to: '/privacy', label: '개인정보처리방침' } },
}

// The privacy policy and the terms, written for visitors rather than lawyers.
function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const navigate = useNavigate()
  const { title, sections, other } = DOCS[doc]
  const back = () => {
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1)
    else navigate('/main')
  }

  return (
    <div className={ui.page}>
      <TopBar title={title} left={{ icon: 'arrow_back', label: '뒤로', onClick: back }} />
      <article className={styles.doc}>
        <p className={styles.date}>시행일 {EFFECTIVE_DATE}</p>
        {sections.map((section, i) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.no}>{i + 1}</span>
              {section.title}
            </h2>
            {section.body.map((part, j) =>
              Array.isArray(part) ? (
                <ul key={j} className={styles.list}>
                  {part.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={j} className={styles.text}>
                  {part}
                </p>
              ),
            )}
          </section>
        ))}
        <div className={`${ui.card} ${styles.contact}`}>
          <span className={styles.contactLabel}>문의처</span>
          {CONTACT_EMAIL ? (
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.contactValue}>
              {CONTACT_EMAIL}
            </a>
          ) : (
            <span className={styles.contactValue}>준비 중이에요</span>
          )}
        </div>
        <button type="button" className={styles.other} onClick={() => navigate(other.to)}>
          {other.label} 보기
        </button>
      </article>
    </div>
  )
}

export default LegalPage
