import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Pullup Gallery',
  description: 'Experience art in augmented reality',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 