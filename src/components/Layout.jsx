import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { useTab } from '@/contexts/TabContext'

export default function Layout({ children }) {
  const location = useLocation()
  const { activeTab, setActiveTab } = useTab()

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-primary">
              Tinnitus Therapy Tool
            </Link>
            <div className="flex items-center gap-4">
              {/* Tab switcher - only show on home page */}
              {location.pathname === '/' && (
                <div className="flex gap-2 border-r border-border pr-4 mr-2">
                  <button
                    onClick={() => setActiveTab('simple')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'simple'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setActiveTab('advanced')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'advanced'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Advanced
                  </button>
                </div>
              )}
              <div className="flex gap-4">
                <Link to="/">
                  <Button
                    variant={location.pathname === '/' ? 'default' : 'ghost'}
                  >
                    Assessment
                  </Button>
                </Link>
                <Link to="/examples">
                  <Button
                    variant={location.pathname === '/examples' ? 'default' : 'ghost'}
                  >
                    Examples
                  </Button>
                </Link>
                <Link to="/about">
                  <Button
                    variant={location.pathname === '/about' ? 'default' : 'ghost'}
                  >
                    About
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}

