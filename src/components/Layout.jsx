import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'

export default function Layout({ children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-primary">
              Tinnitus Therapy Tool
            </Link>
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
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}

