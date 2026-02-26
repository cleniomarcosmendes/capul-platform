import { useState, useCallback, useEffect } from 'react';
import { Outlet, useOutletContext, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface SidebarContext {
  toggleSidebar: () => void;
}

export function useSidebarToggle() {
  return useOutletContext<SidebarContext>();
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Page fade on route change
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <main
        className={`flex-1 flex flex-col min-w-0 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <Outlet context={{ toggleSidebar } satisfies SidebarContext} />
      </main>
    </div>
  );
}
