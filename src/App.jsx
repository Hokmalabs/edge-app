import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import BettingAgent from './pages/BettingAgent'
import BRVMAgent from './pages/BRVMAgent'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto relative min-h-screen bg-edge-bg">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/betting" element={<BettingAgent />} />
          <Route path="/brvm" element={<BRVMAgent />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
