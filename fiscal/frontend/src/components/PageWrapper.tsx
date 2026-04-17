import type { ReactNode } from 'react';
import { Header } from '../layouts/Header';

interface PageWrapperProps {
  title: string;
  children: ReactNode;
}

export function PageWrapper({ title, children }: PageWrapperProps) {
  return (
    <>
      <Header title={title} />
      <div className="p-6">{children}</div>
    </>
  );
}
