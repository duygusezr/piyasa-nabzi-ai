import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';

export default function TopBar() {
  const navigate = useNavigate();
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <span>Canlı Veri</span>
        <span className="text-gray-600 ml-2">•</span>
        <span className="text-yellow-500 text-xs">⚠ Simülasyon modu — gerçek işlem yapılmaz</span>
      </div>
      <button
        onClick={() => navigate('/asistan')}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
      >
        <Bot size={16} />
        AI Asistan
      </button>
    </header>
  );
}
