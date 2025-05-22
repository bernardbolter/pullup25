import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { UserProvider } from '@/providers/UserContext';
import { getMessages } from 'next-intl/server';
import Navigation from '@/components/layout/Navigation';
import '@/styles/main.scss';

const inter = Inter({ subsets: ['latin'] });

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    locale: string;
  };
}

export async function generateMetadata({ params: { locale } }: LocaleLayoutProps) {
  return {
    title: 'The Pullup Gallery',
    description: 'Experience art in augmented reality',
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: LocaleLayoutProps) {
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body className={inter.className}>
        {/* REMOVED AuthProvider wrapper */}
        <NextIntlClientProvider messages={messages} locale={locale}>
          <UserProvider> {/* Our provider is now the top relevant one */}
            <Navigation />
            <main>{children}</main>
          </UserProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
} 