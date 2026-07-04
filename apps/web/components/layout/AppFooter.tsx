export default function AppFooter() {
  return (
    <footer className="border-t border-white/8 bg-black/20 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-xs text-blue-200/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Ambiente interno — uso restrito
            </span>
            <span>Segurança da Informação</span>
          </div>
          <p className="text-xs text-blue-200/35">Versão 0.1.0 — MVP</p>
        </div>
      </div>
    </footer>
  );
}
