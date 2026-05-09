export default function DisclaimerBox() {
  return (
    <div className="border border-amber-700/40 bg-amber-900/10 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">⚠️</div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-300">
            Yasal Uyarı &amp; Kullanım Koşulları
          </p>
          <ul className="text-xs text-amber-200/80 space-y-1.5 list-none">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 flex-shrink-0">•</span>
              Bu sistem <strong>yatırım tavsiyesi sunmaz</strong> ve finansal danışmanlık hizmeti değildir.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 flex-shrink-0">•</span>
              Gerçek para ile <strong>otomatik işlem yapmaz</strong>, kullanıcı adına emir göndermez.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 flex-shrink-0">•</span>
              Tüm çıktılar <strong>yalnızca eğitim, analiz ve simülasyon</strong> amaçlıdır.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 flex-shrink-0">•</span>
              Piyasalarda <strong>sermayenin tamamı kaybedilebilir</strong>. Yatırım kararlarınızda lisanslı bir mali müşavire danışın.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 flex-shrink-0">•</span>
              "Kesin al", "kesin sat" veya "garanti kazanç" içeren hiçbir çıktı sistem tarafından üretilmez.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
