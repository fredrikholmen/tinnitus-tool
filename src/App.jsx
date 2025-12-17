import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Examples from './pages/Examples'
import { TabProvider } from './contexts/TabContext'

function App() {
  return (
    <TabProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/examples" element={<Examples />} />
        </Routes>
      </Layout>
    </TabProvider>
  )
}

export default App

