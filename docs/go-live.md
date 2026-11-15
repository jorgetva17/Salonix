# Salonix — checklist de lançamento (go-live)

Use antes de colocar o primeiro salão piloto em produção. Itens marcados com 🔴 bloqueiam o lançamento.

## 1. Validação que ainda não foi feita (🔴)
O código foi escrito e testado **sem** o Supabase completo (Docker indisponível no ambiente de desenvolvimento). Rode no seu computador:

```bash
npm install
npm run db:start && npm run db:reset
npm run db:test            # pgTAP (Supabase real)
npx playwright test        # e2e: auth, tema, cadastros, agenda, caixa, estoque, financeiro, a11y
npm run db:types           # regera database.types.ts (hoje escrito à mão)
npm run lint && npm run build
```

Conferência manual (dinheiro de mentira): atendimento com pagamento dividido, Pix pendente + confirmação, fechamento de caixa com R$ 1 a menos, estorno, baixa/devolução de estoque, relatório do mês.

## 2. Supabase (produção)
- [ ] 🔴 Projeto criado; `supabase link` + `supabase db push` (9 migrations).
- [ ] 🔴 **Auth → URL Configuration:** *Site URL* = domínio de produção; *Redirect URLs* = `https://SEU-DOMINIO/**`. (O `config.toml` aponta para `localhost` só em desenvolvimento.)
- [ ] 🔴 **Auth → Providers → Email:** ligar **Confirm email** (no `config.toml` local está desligado para facilitar testes).
- [ ] 🔴 **SMTP próprio** (Auth → SMTP). O e-mail embutido do Supabase tem limite muito baixo e não serve para convites reais.
- [ ] Senha mínima de 8 caracteres e "leaked password protection" ligada (Auth → Policies).
- [ ] Revisar os limites de taxa de Auth (login, cadastro, recuperação de senha).
- [ ] **Backups:** ativar PITR/backups diários (plano Pro) e testar uma restauração.
- [ ] Storage: bucket `salon-logos` público só para leitura (já criado pela migration).
- [ ] Realtime: a tabela `appointments` está na publicação `supabase_realtime` (migration 05).
- [ ] Executar o *Security Advisor* do Supabase e corrigir alertas.

## 3. Vercel
- [ ] 🔴 Variáveis (Production **e** Preview, valores diferentes se possível): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (**sem** prefixo `NEXT_PUBLIC_`), `NEXT_PUBLIC_SITE_URL`.
- [ ] 🔴 **Deployment Protection:** desligar *Vercel Authentication* na produção (clientes não têm conta Vercel).
- [ ] 🔴 Plano **Pro** antes de cobrar clientes (o Hobby é só para uso pessoal/não comercial).
- [ ] Domínio próprio + SSL; região das functions `gru1` (já em `vercel.json`).
- [ ] Sem as variáveis o app responde **503 "Configuração pendente"** (comportamento intencional).

## 4. Segurança (já feito no código)
- RLS em todas as tabelas; escrita sensível só por RPCs com checagem de perfil; testes pgTAP de invariantes (`supabase/tests/hardening.test.sql`).
- Privilégios padrão do Supabase revogados para `anon`; tabelas só-RPC sem DML direto.
- Cabeçalhos: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Exportação CSV neutraliza injeção de fórmula.
- Upload de logo validado por conteúdo (magic bytes), SVG só via `<img>`.

### Limitações conhecidas (decisões pendentes)
- **Sem Content-Security-Policy.** Exige nonce por requisição no Next; fica para depois do piloto.
- **Cadastro revela se um e-mail já existe** ("Este e-mail já está cadastrado"). Troca de usabilidade por privacidade; avaliar.
- `create_salon` não tem limite por usuário (qualquer conta pode criar vários salões). Aceitável no piloto; limitar antes de abrir cadastro público.
- Baixa de estoque e comissão são por atendimento; não há bloqueio de venda com estoque negativo (por decisão do spec).

## 5. LGPD (dados de clientes: nome e WhatsApp)
- [ ] Política de privacidade e termos de uso publicados; base legal (execução de contrato / legítimo interesse).
- [ ] Definir como o salão atende pedidos de exclusão/acesso de clientes (hoje: admin/recepção exclui o cliente; clientes com atendimentos não podem ser excluídos — decidir anonimização).
- [ ] Contrato de operador com o salão (o Salonix processa dados em nome dele).
- [ ] Região dos dados: o projeto Supabase deve estar em região adequada (ex.: São Paulo).

## 6. Operação
- [ ] Monitoramento de erros (ex.: Sentry/Vercel Observability) e alerta de falha de deploy.
- [ ] Rotina de verificação do caixa e do relatório no primeiro mês do piloto.
- [ ] Canal de suporte e plano de rollback (reverter deploy no Vercel; migrations só para frente).
