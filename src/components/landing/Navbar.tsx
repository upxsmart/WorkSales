import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30">
      <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
        <span className="font-display text-xl font-bold gradient-text">WorkSales</span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preços</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Agentes</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sobre</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Entrar</Button>
          <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => navigate("/auth")}>Criar Conta</Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-border/30 p-4 space-y-3">
          <a href="#pricing" className="block text-sm text-muted-foreground">Preços</a>
          <a href="#" className="block text-sm text-muted-foreground">Agentes</a>
          <a href="#" className="block text-sm text-muted-foreground">Sobre</a>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate("/auth")}>Entrar</Button>
            <Button size="sm" className="flex-1 gradient-primary text-primary-foreground" onClick={() => navigate("/auth")}>Criar Conta</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
