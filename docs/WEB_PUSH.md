# Ativação de Web Push

A aplicação continua gerando notificações internas sem VAPID. Para habilitar push:

1. Execute `node scripts/generate_vapid.mjs` em um ambiente seguro. Guarde o par; trocar a chave pública exige reinscrever os dispositivos.
2. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (contato real `mailto:` ou HTTPS) no Infisical do backend ou no `.env` do Compose. Na VPS compartilhada, use `TENNO_VAPID_PUBLIC_KEY` e `TENNO_VAPID_PRIVATE_KEY` no `deploy/shared-vps/vps.env` local (modo 600); `./tenno run deploy:prod` transfere o par por stdin para `/etc/tenno-talk/tenno.env` (modo 640). `TENNO_VAPID_SUBJECT` usa `https://<domínio>` por padrão. A chave privada nunca vai para o frontend nem para o git.
3. Publique backend e frontend juntos, com a migration V5. Sirva `/sw.js` na raiz por HTTPS, sem cache imutável. O worker não armazena páginas ou respostas autenticadas.
4. Entre no aplicativo e habilite push em Settings → Notifications. A solicitação de permissão ocorre somente ao tocar no botão. No iPhone/iPad, use o aplicativo adicionado à tela inicial em uma versão compatível com Web Push. O backend aceita endpoints dos serviços de Chrome, Firefox, Safari e Edge, incluindo WNS.
5. Com duas contas e aparelhos, habilite push na conta destinatária, feche o app e envie uma mensagem da outra conta. Confira recebimento, clique no destino e contador. Repita negando permissão, silenciando a conversa, desativando o tipo de aviso e saindo da conta.

O envio usa notificações genéricas, sem conteúdo privado no payload. Inscrições expiradas (404/410) são removidas; falhas transitórias têm retry; notificações já lidas, bloqueadas ou expiradas não são enviadas. Há deduplicação por notificação/dispositivo e `tag` no sistema operacional. A entrega pelo provedor push não marca a mensagem do chat como entregue: isso requer ACK do app.

O logout remove a inscrição deste navegador antes de encerrar a sessão. Mensagens de saída ficam guardadas no dispositivo, isoladas por conta, e retomam ao entrar na mesma conta. A lista de chats mostra pendências e permite descartar ou tentar novamente falhas. O servidor valida a conta original também nas requisições de replay.

A validação automatizada cobre contratos, autorização e persistência local; recebimento com app fechado e comportamento do teclado/safe area em aparelhos reais precisam do ensaio acima após configurar as chaves.

A lista de endpoints do Windows é documentada pela [Microsoft](https://learn.microsoft.com/en-us/intune/fundamentals/endpoints); o uso de WNS pelo Edge é descrito na [documentação do Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/forcebuiltinpushmessagingclient).
