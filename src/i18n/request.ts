import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
  console.log('i18n/request.ts - Raw locale:', locale);
  console.log('i18n/request.ts - Locale type:', typeof locale);
  
  // Use default locale if none provided
  const finalLocale = locale || 'en';
  console.log('i18n/request.ts - Final locale:', finalLocale);

  try {
    const messages = (await import(`../messages/${finalLocale}/common.json`)).default;
    return {
      locale: finalLocale,
      messages,
      timeZone: 'UTC'
    };
  } catch (error) {
    console.error(`i18n/request.ts - Failed to load messages for locale: ${finalLocale}`, error);
    throw new Error(`Failed to load messages for locale: ${finalLocale}`);
  }
}); 