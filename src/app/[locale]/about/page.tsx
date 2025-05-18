import { useTranslations } from 'next-intl';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - The Pullup Gallery',
  description: 'Learn about The Pullup Gallery and our mission to bring art to life through augmented reality',
};

export default function AboutPage() {
  const t = useTranslations('about');

  return (
    <div className="about">
      <div className="about__header">
        <h1 className="about__title">{t('title')}</h1>
        <p className="about__description">{t('description')}</p>
      </div>

      <div className="about__content">
        <section className="about__section">
          <h2 className="about__section-title">{t('mission.title')}</h2>
          <p className="about__section-text">{t('mission.description')}</p>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">{t('howItWorks.title')}</h2>
          <div className="about__steps">
            <div className="about__step">
              <h3 className="about__step-title">{t('howItWorks.step1.title')}</h3>
              <p className="about__step-text">{t('howItWorks.step1.description')}</p>
            </div>
            <div className="about__step">
              <h3 className="about__step-title">{t('howItWorks.step2.title')}</h3>
              <p className="about__step-text">{t('howItWorks.step2.description')}</p>
            </div>
            <div className="about__step">
              <h3 className="about__step-title">{t('howItWorks.step3.title')}</h3>
              <p className="about__step-text">{t('howItWorks.step3.description')}</p>
            </div>
          </div>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">{t('contact.title')}</h2>
          <p className="about__section-text">{t('contact.description')}</p>
          <a href={`mailto:${t('contact.email')}`} className="about__contact-link">
            {t('contact.email')}
          </a>
        </section>
      </div>
    </div>
  );
} 