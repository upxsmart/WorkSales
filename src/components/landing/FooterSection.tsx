const FooterSection = () => {
  return (
    <footer className="border-t border-border/50 py-12 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-display text-xl font-bold gradient-text mb-3">WorkSales</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Plataforma de IA para infoprodutores construírem sua estrutura digital completa.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-foreground transition-colors cursor-pointer">Agentes de IA</li>
              <li className="hover:text-foreground transition-colors cursor-pointer">Preços</li>
              <li className="hover:text-foreground transition-colors cursor-pointer">Documentação</li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-foreground transition-colors cursor-pointer">Sobre</li>
              <li className="hover:text-foreground transition-colors cursor-pointer">Blog</li>
              <li className="hover:text-foreground transition-colors cursor-pointer">Contato</li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-foreground transition-colors cursor-pointer">Termos de Uso</li>
              <li className="hover:text-foreground transition-colors cursor-pointer">Privacidade</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          © 2026 WorkSales. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
