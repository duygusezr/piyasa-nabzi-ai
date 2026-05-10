import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import OverviewPage from './pages/OverviewPage';
import MarketPage from './pages/MarketPage';
import NewsPage from './pages/NewsPage';
import SimulationPage from './pages/SimulationPage';
import AssistantPage from './pages/AssistantPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/piyasa" element={<MarketPage />} />
            <Route path="/haberler" element={<NewsPage />} />
            <Route path="/simulasyon" element={<SimulationPage />} />
            <Route path="/asistan" element={<AssistantPage />} />
            <Route path="/ayarlar" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
