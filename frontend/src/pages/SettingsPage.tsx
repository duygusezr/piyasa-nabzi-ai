export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ayarlar</h1>
        <p className="text-gray-400 text-sm mt-1">Uygulama bilgileri ve veri kaynakları</p>
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-white font-semibold">Veri Kaynakları</h2>
        {[
          { name: 'Kripto Verisi', source: 'Binance API', status: 'Aktif' },
          { name: 'Döviz / Altın', source: 'TCMB XML', status: 'Aktif' },
          { name: 'BIST Verileri', source: 'Yahoo Finance', status: 'Gecikmeli' },
          { name: 'Haberler', source: 'CollectAPI + RSS', status: 'Aktif' },
          { name: 'AI Analiz', source: 'Google Gemini', status: 'Aktif' },
          { name: 'Çeviri', source: 'DeepL API', status: 'Aktif' },
        ].map(item => (
          <div key={item.name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
            <div>
              <p className="text-white text-sm">{item.name}</p>
              <p className="text-gray-500 text-xs">{item.source}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${
              item.status === 'Aktif' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
            }`}>{item.status}</span>
          </div>
        ))}
      </div>
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-yellow-400 font-medium text-sm mb-2">⚠ Önemli Uyarı</p>
        <p className="text-yellow-300/70 text-xs leading-relaxed">
          Bu uygulama yatırım tavsiyesi vermemektedir. Tüm veriler bilgilendirme amaçlıdır.
          Simülasyon işlemleri tamamen sanal olup gerçek para ile işlem yapılmaz.
          Gerçek yatırım kararları için bir finansal danışmana başvurun.
        </p>
      </div>
    </div>
  );
}
