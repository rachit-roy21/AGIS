import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  requiresAuth?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: '📊', requiresAuth: true },
  { name: 'Documents', href: '/documents', icon: '📄', requiresAuth: true },
  { name: 'Chat', href: '/chat', icon: '💬', requiresAuth: true },
  { name: 'Debate', href: '/debate', icon: '⚖️', requiresAuth: true },
  { name: 'Settings', href: '/settings', icon: '⚙️', requiresAuth: true },
  { name: 'Test Lab', href: '/test', icon: '🧪', requiresAuth: false },
];

export function Navigation() {
  const location = useLocation();
  const { session, isSessionValid } = useSession();

  const isAuthEnabled = session.isActive && isSessionValid();

  const filteredNavigation = navigation.filter(item =>
    !item.requiresAuth || isAuthEnabled
  );

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`
                  px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}