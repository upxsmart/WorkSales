

# WorkSales — Plano de Implementação

## Visão Geral
Plataforma SaaS para infoprodutores construírem sua estrutura de negócio digital completa usando 7 agentes de IA especializados que trabalham em ecossistema integrado.

---

## 1. Landing Page
- Hero com headline "Construa Seu Império Digital com 7 Agentes de IA"
- Tema escuro premium (slate-900 base, acentos indigo-500 e amber-500)
- Cards com glassmorphism mostrando os 6 benefícios principais
- Seção "Como Funciona" em 3 passos visuais
- Seção de planos/preços (Starter, Pro, Enterprise)
- CTA forte para cadastro
- Footer com links institucionais

## 2. Autenticação
- Login e cadastro via Supabase Auth (email/senha)
- Recuperação de senha com página dedicada
- Redirecionamento para onboarding no primeiro login
- Tabela de perfis com dados do usuário (nome, plano)

## 3. Onboarding (Wizard 5 passos)
- Passo 1: Nicho de atuação (texto + sugestões)
- Passo 2: Já tem produto digital? (Sim/Não + descrição)
- Passo 3: Público-alvo (descrição livre)
- Passo 4: Objetivo principal (4 opções radio)
- Passo 5: Faturamento atual (5 faixas radio)
- Barra de progresso animada
- Salva projeto no Supabase ao finalizar

## 4. Dashboard Principal
- Saudação personalizada ("Olá, [nome]!")
- Card de progresso geral da estrutura
- Grid 2x4 com os 7 agentes, cada um mostrando ícone, nome, status e botão "Iniciar"
- Sidebar fixa com navegação: Dashboard, Meus Projetos, Agentes, Documentos Gerados, Métricas, Configurações

## 5. Os 7 Agentes de IA
Cada agente terá sua própria página com interface de chat/formulário e exibirá suas entregas específicas:

- **AA-D100** — Análise de Audiência e Dream 100: Gera micro-personas, lista Dream 100, mapa de dores × desejos
- **AO-GO** — Otimização de Ofertas Grand Slam: Cria Escada de Valor com 5 degraus, equação de valor, variações de copy
- **AJ-AF** — Jornada e Automação de Funil: Mapeia jornada do lead, gatilhos, sequências de email, lead scoring
- **AE-C** — Engajamento Conversacional: Scripts de Epiphany Bridge, fluxos de conversa, qualificação BANT
- **AM-CC** — Marketing e Conteúdo Criativo: Páginas de vendas, sequências de email, hooks, scripts de vídeo
- **AC-DC** — Design e Criativos: Briefings visuais, prompts de geração de imagem, specs por plataforma
- **ACO** — Orquestrador Central: Diagnóstico de coerência, identificação de gaps, plano de ação priorizado

O sistema respeitará as dependências entre agentes (ex: AO-GO só funciona após AA-D100 ter output).

## 6. Integração com IA (Anthropic Claude)
- Edge function no Supabase para chamadas à API da Anthropic
- Chave API armazenada como secret no Supabase
- Streaming de respostas token-a-token
- Diferentes modelos por agente conforme especificado (Sonnet 4.5, Haiku 4.5)

## 7. Pagamentos com Stripe
- Assinatura mensal com 3 planos
- Integração Stripe via Supabase Edge Functions
- Portal de gerenciamento de assinatura para o usuário

## 8. Banco de Dados (Supabase)
- Tabelas: profiles, projects, agent_outputs, agent_tasks, user_roles
- RLS habilitado em todas as tabelas
- Cada usuário só acessa seus próprios dados
- Outputs dos agentes versionados (histórico de versões)

