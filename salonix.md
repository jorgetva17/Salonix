# SKILL — Projeto Salonix: Gestão para Barbearias e Salões

## 1. Visão geral do App
O **Salonix** é um aplicativo de gestão para barbearias e salões de cabeleireiro,
voltado a pequenos e médios negócios brasileiros. Reúne em um só lugar o
agendamento de clientes (inclusive os que chegam sem hora marcada), o controle
de equipamentos e materiais, o financeiro do dia a dia e a gestão da equipe com
comissionamento. O app é responsivo (celular, tablet e PC/notebook), oferece
tema claro e dark e permite que cada usuário personalize a identidade visual
com a própria logomarca.

- **Nome**: Salonix (alternativas avaliadas: Cortaê, Barbea, EstiloPrime)
- **Identidade visual**: emblema S + X com tesoura e navalha; paleta
  azul-petróleo (#1B3B4B) e âmbar (#F59E0B); logomarcas clara e dark já geradas.
- **Público**: donos, recepções e profissionais de barbearias e salões no Brasil.

## 2. Objetivo do projeto
Desenvolver um **MVP funcional e bem estruturado** que resolva a operação diária
da barbearia/salão — agenda, caixa, estoque e equipe — com qualidade técnica
suficiente para evoluir sem refatoração. O MVP deve ser simples, correto e
testável, priorizando o fluxo completo de atendimento antes de refinamentos
visuais e integrações avançadas.

## 3. Escopo inicial (MVP)
Estão dentro do escopo inicial:

1. Agendamento com fila de walk-in (clientes sem hora marcada).
2. Atendimento com registro de forma de pagamento (dinheiro, débito, crédito, Pix).
3. Controle de estoque com baixa automática de materiais por serviço.
4. Controle de equipamentos e histórico de manutenção.
5. Financeiro com recebimentos, pagamentos, fechamento de caixa e relatórios.
6. Cadastro de usuários com três perfis (Admin/Dono, Recepção, Profissional).
7. Comissionamento percentual por profissional (e, opcionalmente, por serviço).
8. Upload de logomarca própria por usuário e tema claro/dark.

Fora do escopo do MVP (futuras fases):
- Conciliação automática com operadoras de cartão (camada preparada, flag desligada).
- Envio automático de lembretes por WhatsApp (MVP: link wa.me com mensagem pronta).
- Notificações push, e-commerce de produtos, fidelidade, multi-unidades.

## 4. Funcionalidades principais

### 4.1 Agendamento
- Agenda por profissional com horários configuráveis e bloqueios (folga, férias).
- Serviços com nome, duração e preço.
- Agendamento, reagendamento e cancelamento com histórico.
- **Fila de walk-in**: botão "Cliente na porta" enfileira o cliente no próximo
  horário/profissional disponível, com fila visível em tempo real.

### 4.2 Atendimento e caixa
- Fluxo: iniciar atendimento → concluir → registrar forma de pagamento →
  baixa de estoque → cálculo de comissão.
- Caixa do dia com conferência por forma de pagamento e fechamento.

### 4.3 Estoque e equipamentos
- Itens de consumo (shampoo, talco, lâminas, escovas, pentes etc.) com estoque
  mínimo e alertas.
- Vínculo serviço ↔ itens consumidos com baixa automática e movimentações
  registradas.
- Equipamentos com status, responsável e histórico de manutenção.

### 4.4 Financeiro
- Recebimentos por dinheiro, débito, crédito e Pix (confirmação manual do Pix
  no MVP, com webhook preparado para automação).
- Contas a pagar (aluguel, luz, água, produtos, manutenção).
- Relatórios: faturamento por período, serviço, profissional e forma de
  pagamento; custo real por atendimento; comissões do mês.

### 4.5 Equipe e acesso
- Autenticação com e-mail/senha e recuperação de senha.
- Perfis: Admin/Dono (acesso total), Recepção (agenda e caixa), Profissional
  (sua agenda, seus recebimentos e comissão).
- Percentual de comissão configurável por profissional e por serviço.

## 5. Requisitos básicos
- **Stack sugerida**: Next.js (App Router) + TypeScript + Tailwind CSS +
  shadcn/ui; Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Banco**: modelo de dados com users, professionals, services, appointments,
  customers, equipment, equipment_maintenance, inventory_items,
  service_consumables, stock_movements, transactions e commissions.
- **Segurança**: Row Level Security por usuário/tenant; roles validadas no
  banco; validação de entrada em cliente e servidor.
- **Responsividade**: mobile-first, operável com uma mão no celular.
- **Temas**: claro e dark, com preferência persistida por usuário.
- **Personalização**: upload de logo (PNG/JPG/SVG) via Storage, com fallback
  para a logo padrão.
- **PWA** com manifest e ícones para instalação na tela inicial.
- **Localização**: pt-BR, moeda BRL, fuso America/Sao_Paulo (timestamps em UTC).

## 6. Considerações de experiência do usuário
- Ações principais sempre em no máximo 2 toques (agendar, atender, receber).
- Dashboard por perfil: o profissional vê apenas o que lhe interessa.
- Estados de loading, vazio e erro em todas as telas, com mensagens em pt-BR.
- Fila de walk-in visível e atualizada em tempo real na tela de recepção.
- Botões grandes e rodapé de navegação no celular; layout fluido no tablet e
  no desktop.

## 7. Tecnologias e componentes a definir depois
- Provedor de pagamentos (Mercado Pago, PagSeguro, Pagar.me, Asaas, Stone) e
  ativação do webhook de Pix.
- Envio automático de mensagens por WhatsApp (API oficial).
- Estratégia de notificações push.
- Backup e política de retenção de dados (LGPD).
- Hospedagem de produção e domínio (Vercel ou equivalente + Supabase cloud).
- Testes automatizados mais amplos e CI/CD.

## 8. Próximos passos para evolução
1. Validar o fluxo completo do MVP em ambiente real com 1–2 barbearias piloto.
2. Coletar feedback sobre agenda, walk-in e fechamento de caixa; ajustar UX.
3. Ativar integração com operadora de cartão e webhook de Pix (flag existente).
4. Implementar lembretes automáticos por WhatsApp.
5. Evoluir relatórios (lucro real por serviço, curva ABC de produtos).
6. Planejar fases 2+: fidelidade de clientes, multi-unidades, app do cliente
   final para autoagendamento.