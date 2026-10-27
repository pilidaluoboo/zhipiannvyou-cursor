import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Analytics } from '@vercel/analytics/next';
import { CrispChat } from '@/components/crisp-chat';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '纸片女友 | 虚拟恋爱聊天',
    template: '%s | 纸片女友',
  },
  description:
    '纸片女友 - 与四位性格迥异的虚拟女友进行甜蜜聊天，体验真实的恋爱氛围',
  keywords: [
    '纸片女友',
    '虚拟恋爱',
    'AI聊天',
    '恋爱模拟',
  ],
  authors: [{ name: 'Paper Girlfriend' }],
  generator: 'Coze Code',
  openGraph: {
    title: '纸片女友 | 虚拟恋爱聊天',
    description: '与四位性格迥异的虚拟女友进行甜蜜聊天',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
        <CrispChat />
        <Analytics />
      </body>
    </html>
  );
}
