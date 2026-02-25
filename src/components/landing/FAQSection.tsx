import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    question: "Funciona para qualquer nicho?",
    answer:
      "Sim! Os agentes são treinados para atuar em qualquer nicho de mercado — de e-commerce a serviços profissionais, infoprodutos, SaaS, negócios locais e muito mais. Na etapa de onboarding você informa seu nicho e os agentes adaptam toda a estratégia ao seu contexto específico.",
  },
  {
    question: "Preciso saber usar IA para aproveitar a plataforma?",
    answer:
      "Não. A interface é conversacional: você apenas responde perguntas e os agentes fazem todo o trabalho pesado. Não é necessário escrever prompts, configurar modelos ou ter qualquer conhecimento técnico de inteligência artificial.",
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer:
      "Sim, sem burocracia. Você pode cancelar sua assinatura direto pelo painel de configurações. O acesso continua ativo até o fim do período já pago e não há multa ou fidelidade.",
  },
  {
    question: "Em quanto tempo vejo resultados?",
    answer:
      "O Maestro (orquestrador) entrega um plano completo — personas, oferta, funil, copy, criativos e mídia — em minutos. A partir daí, você pode executar imediatamente. Clientes costumam lançar campanhas no mesmo dia.",
  },
  {
    question: "Os conteúdos gerados são únicos?",
    answer:
      "Sim. Cada output é gerado sob medida para o seu projeto, com base no seu nicho, público, oferta e tom de marca. Nenhum template pré-pronto — tudo é criado do zero pelos agentes.",
  },
  {
    question: "Quantos projetos posso criar?",
    answer:
      "Depende do plano. O plano Starter permite 1 projeto, o Pro permite até 5 e o Business até 20 projetos simultâneos. Cada projeto tem seu próprio contexto, histórico e outputs.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-20 md:py-28 bg-muted/30">
      <div className="container max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold tracking-widest uppercase text-primary">
            Perguntas Frequentes
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
            Tire suas dúvidas
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Tudo o que você precisa saber antes de começar a escalar com IA.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3">
          {FAQ_ITEMS.map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`faq-${idx}`}
              className="border border-border/60 rounded-lg bg-card px-5 data-[state=open]:shadow-md transition-shadow"
            >
              <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline py-5">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
