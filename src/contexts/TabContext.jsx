import { createContext, useContext, useState } from 'react'

const TabContext = createContext(null)

export function TabProvider({ children }) {
  const [activeTab, setActiveTab] = useState('simple')
  
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  )
}

export function useTab() {
  const context = useContext(TabContext)
  if (!context) {
    throw new Error('useTab must be used within TabProvider')
  }
  return context
}

